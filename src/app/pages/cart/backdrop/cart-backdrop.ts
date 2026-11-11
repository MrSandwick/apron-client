import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { MOTION_OK, motionAllowed } from '../../../shared/motion';
import { BackdropMood, BackdropScene, Budget, Frame } from './backdrop-scene';
import { budget, clamp, mulberry32, readPalette } from './backdrop-kit';
import { bokehScene } from './bokeh';

// Fixed seed so the bokeh always lays out the same way
const SEED = 20240611;
const MAX_DT = 0.1; // seconds, stops a long stall from becoming one huge step
const LOW_POWER_FRAME_MS = 28; // skips alternate 60Hz frames, so about 30 fps
const PARALLAX_EASE = 0.08; // fraction of the gap closed per 16 ms
const MOOD_RATE = 2.5; // exponential rate: the mood settles (95%) in about 1.2 s
const TOUCH_SCROLL_RANGE = 1200; // scroll pixels that map to a full py step
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

// Decorative 2D canvas behind the cart page. Mounts the bokeh scene, drives its
// loop only while visible and motion is allowed, and draws one still frame otherwise.
// It fades in slowly when it appears. Nothing here runs on the server; if the canvas
// cannot start, the page's CSS gradient stays as the fallback.
@Component({
  selector: 'app-cart-backdrop',
  templateUrl: './cart-backdrop.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed inset-0 overflow-hidden motion-safe:animate-backdrop-in',
    'aria-hidden': 'true',
  },
})
export class CartBackdrop {
  readonly mood = input<BackdropMood>('warm');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private g?: CanvasRenderingContext2D;
  private scene?: BackdropScene;
  private frame?: Frame;
  private bud?: Budget;
  // Set once the canvas is up; the effects ignore changes before this
  private ready = false;
  private destroyed = false;
  // False for reduced motion (or no requestAnimationFrame): one still frame, no loop
  private motion = false;
  private cssW = 1;
  private cssH = 1;

  // Parallax and mood targets
  private tx = 0;
  private ty = 0;
  private moodTarget = 0;

  // Loop state
  private raf?: number;
  private last?: number;
  private inView = true;
  private docVisible = true;

  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private listeningPointer = false;
  private listeningScroll = false;
  private listeningVisibility = false;
  // Watches the reduced-motion preference so the loop follows it while the page is open
  private motionQuery?: MediaQueryList;
  // Cached at init so teardown never reads the query after the view is gone
  private canvasEl?: HTMLCanvasElement;

  constructor() {
    // Browser only: nothing touches the canvas during prerender
    afterNextRender(() => this.init());

    // Follow the mood input after init
    effect(() => {
      const mood = this.mood();
      if (!this.ready) return;
      untracked(() => this.setMood(mood));
    });

    this.destroyRef.onDestroy(() => this.teardown());
  }

  private init(): void {
    if (this.destroyed) return;
    const canvas = this.canvas().nativeElement;
    this.canvasEl = canvas;

    // No 2D context (unsupported or blocked): stay blank and let the CSS gradient show
    let g: CanvasRenderingContext2D | null = null;
    try {
      g = canvas.getContext('2d');
    } catch {
      g = null;
    }
    if (!g) return;
    this.g = g;

    this.bud = budget();
    this.motion = this.motionOn();
    this.moodTarget = this.mood() === 'cool' ? 1 : 0;
    this.frame = {
      px: 0,
      py: 0,
      mood: this.moodTarget,
      palette: readPalette(),
      time: 0,
    };
    this.scene = bokehScene(this.bud, mulberry32(SEED));
    this.ready = true;

    // Sizing also draws the first frame (the only one under reduced motion)
    this.resize();
    this.observeSize(canvas);
    this.watchMotionPreference();

    if (!this.motion) return;
    this.startMotion();
  }

  // Motion needs the preference and a frame clock
  private motionOn(): boolean {
    return motionAllowed() && typeof window.requestAnimationFrame === 'function';
  }

  private watchMotionPreference(): void {
    try {
      this.motionQuery = window.matchMedia(MOTION_OK);
      this.motionQuery.addEventListener?.('change', this.onMotionChange);
    } catch {
      this.motionQuery = undefined;
    }
  }

  // Reduced motion stops the loop and leaves one still frame; allowing it again restarts the loop
  private readonly onMotionChange = (): void => {
    if (!this.ready || this.destroyed) return;
    const next = this.motionOn();
    if (next === this.motion) return;
    this.motion = next;
    if (next) {
      this.startMotion();
    } else {
      this.stopMotion();
      if (this.frame) this.frame.mood = this.moodTarget;
      this.paint(0);
    }
  };

  private startMotion(): void {
    this.listenInput();
    this.observeVisibility();
    this.sync();
  }

  // Cancels the frame request and drops the input, visibility and scroll hooks
  private stopMotion(): void {
    if (this.raf !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.raf);
    }
    this.raf = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    if (this.listeningPointer) window.removeEventListener('pointermove', this.onPointer);
    if (this.listeningScroll) window.removeEventListener('scroll', this.onScroll);
    if (this.listeningVisibility) {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.listeningPointer = false;
    this.listeningScroll = false;
    this.listeningVisibility = false;
    this.inView = true;
    this.docVisible = true;
  }

  // Matches the canvas buffer to its CSS size at the budget's pixel ratio
  private resize(): void {
    const g = this.g;
    const bud = this.bud;
    const scene = this.scene;
    if (!g || !bud || !scene) return;
    const canvas = this.canvasEl;
    if (!canvas) return;
    this.cssW = Math.max(1, Math.round(canvas.clientWidth));
    this.cssH = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = Math.round(this.cssW * bud.dpr);
    canvas.height = Math.round(this.cssH * bud.dpr);
    g.setTransform(bud.dpr, 0, 0, bud.dpr, 0, 0);
    scene.resize(this.cssW, this.cssH);
    // Resizing clears the bitmap, so redraw now unless the loop is about to
    if (!this.motion || this.raf === undefined) this.paint(0);
  }

  private observeSize(canvas: HTMLCanvasElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
  }

  private observeVisibility(): void {
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        this.inView = entry.isIntersecting;
        this.sync();
      });
      this.intersectionObserver.observe(this.host.nativeElement);
    }
    if (typeof document !== 'undefined') {
      this.docVisible = !document.hidden;
      document.addEventListener('visibilitychange', this.onVisibility);
      this.listeningVisibility = true;
    }
  }

  // Pointer parallax on fine pointers; scroll-driven py on touch
  private listenInput(): void {
    let fine = false;
    try {
      fine = window.matchMedia(FINE_POINTER).matches;
    } catch {
      fine = false;
    }
    if (fine) {
      window.addEventListener('pointermove', this.onPointer, { passive: true });
      this.listeningPointer = true;
    } else {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.listeningScroll = true;
      this.onScroll();
    }
  }

  private readonly onPointer = (e: PointerEvent): void => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.tx = clamp((e.clientX / w) * 2 - 1, -1, 1);
    this.ty = clamp((e.clientY / h) * 2 - 1, -1, 1);
  };

  private readonly onScroll = (): void => {
    this.tx = 0;
    this.ty = clamp(window.scrollY / TOUCH_SCROLL_RANGE, -1, 1);
  };

  private readonly onVisibility = (): void => {
    this.docVisible = !document.hidden;
    this.sync();
  };

  // Starts or stops the loop to match motion, on-screen and tab-visible state
  private sync(): void {
    if (!this.ready) return;
    const shouldRun = this.motion && this.inView && this.docVisible && !this.destroyed;
    if (shouldRun && this.raf === undefined) {
      // Forget the last timestamp so the first dt after a pause is zero
      this.last = undefined;
      this.raf = window.requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.raf !== undefined) {
      window.cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
  }

  private readonly tick = (now: number): void => {
    this.raf = undefined;
    const last = this.last;
    const elapsed = last === undefined ? 0 : now - last;

    // Low-power devices render about every other frame
    if (this.bud?.lowPower && last !== undefined && elapsed < LOW_POWER_FRAME_MS) {
      this.raf = window.requestAnimationFrame(this.tick);
      return;
    }

    const dt = Math.min(MAX_DT, elapsed / 1000);
    this.last = now;
    this.advance(dt);
    this.paint(dt);
    this.raf = window.requestAnimationFrame(this.tick);
  };

  // Eases parallax and mood toward their targets and moves the clock
  private advance(dt: number): void {
    const frame = this.frame;
    if (!frame) return;
    frame.time += dt;

    // Slow idle drift keeps the scene alive when the pointer is still
    const driftX = Math.sin(frame.time * 0.23) * 0.12;
    const driftY = Math.cos(frame.time * 0.17) * 0.08;
    const parallax = 1 - Math.pow(1 - PARALLAX_EASE, (dt * 1000) / 16);
    frame.px += (clamp(this.tx + driftX, -1, 1) - frame.px) * parallax;
    frame.py += (clamp(this.ty + driftY, -1, 1) - frame.py) * parallax;

    frame.mood += (this.moodTarget - frame.mood) * (1 - Math.exp(-MOOD_RATE * dt));
  }

  // Clears the canvas and renders one step of the scene
  private paint(dt: number): void {
    const g = this.g;
    const scene = this.scene;
    const frame = this.frame;
    if (!g || !scene || !frame) return;
    g.clearRect(0, 0, this.cssW, this.cssH);
    scene.step(dt, frame);
    scene.draw(g, frame);
  }

  private setMood(mood: BackdropMood): void {
    const target = mood === 'cool' ? 1 : 0;
    if (target === this.moodTarget) return;
    this.moodTarget = target;
    if (this.motion || !this.frame) return;
    // Reduced motion: jump straight to the target and redraw once
    this.frame.mood = this.moodTarget;
    this.paint(0);
  }

  private teardown(): void {
    this.destroyed = true;
    this.stopMotion();
    this.motionQuery?.removeEventListener?.('change', this.onMotionChange);
    this.resizeObserver?.disconnect();
    this.scene?.dispose();
    this.scene = undefined;
    // Release the bitmap memory
    if (this.canvasEl) {
      this.canvasEl.width = 0;
      this.canvasEl.height = 0;
    }
  }
}

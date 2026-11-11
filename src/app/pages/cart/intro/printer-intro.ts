import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { motionAllowed } from '../../../shared/motion';
import {
  IntroPalette,
  LandingRect,
  PrinterIntroScene,
  PrinterIntroSceneOptions,
  ticketAspect,
} from './intro-contract';
import { unionRect } from './card-rect';
import { IntroFade, buildIntroTimeline } from './intro-timeline';
import { createPrinterIntroScene, readIntroPalette } from './printer-intro-scene';
import { createCardTexture } from './receipt-texture';
import { webglAvailable } from './webgl';

type Three = typeof import('three');
type RoundedBoxModule = typeof import('three/addons/geometries/RoundedBoxGeometry.js');
type RoundedBox = RoundedBoxModule['RoundedBoxGeometry'];
type Gsap = typeof import('gsap').gsap;

// If the intro has not started this long after mount, the page is shown without it
const WATCHDOG_MS = 2500;
const MAX_DPR = 2;
const POINTER_EASE = 0.08; // fraction of the gap closed per 16 ms
const MAX_FRAME_MS = 100; // a stalled frame counts as this long, so the pointer never jumps
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const SPEED_STEP = 1.2; // each press adds this to the playback speed
const MAX_SPEED = 6; // playback speed never goes above this
const SPEED_RAMP_S = 0.15; // seconds a speed change takes to settle

// Full-screen printer intro for the cart page: a 3D receipt printer feeds a ticket that is a
// picture of the real receipt card (minus its dynamic content) and lands it exactly on that card.
// three.js and gsap are fetched on demand. The host emits
// `started` when the first frame is about to play, `reveal` when the page may start fading in, and
// `done` exactly once when the overlay is finished (also when it is skipped, unsupported, or
// failed, so the page never waits on it). Nothing runs on the server.
@Component({
  selector: 'app-cart-printer-intro',
  templateUrl: './printer-intro.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[60] block',
    // A modal dialog over the page while it plays; the canvas inside is decorative
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Cart intro',
    // Once finished the overlay must not catch clicks even if the parent keeps it mounted
    '[class.pointer-events-none]': 'finished()',
    '[class.invisible]': 'finished()',
    // A press anywhere but the Skip button speeds the intro up, as do Enter and Space; Esc skips
    '(pointerdown)': 'onPress($event)',
    '(keydown)': 'onKey($event)',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class CartPrinterIntro {
  readonly started = output<void>();
  readonly reveal = output<void>();
  readonly done = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly skipButton = viewChild.required<ElementRef<HTMLButtonElement>>('skipBtn');

  // Opacity of the canvas wrapper, driven by the timeline's fade tween
  protected readonly fade = signal(1);
  protected readonly finished = signal(false);
  // True after the first press, which fades the speed-up hint out
  protected readonly pressed = signal(false);

  // Plain object the timeline tweens; paint() copies it into the fade signal
  private readonly fadeState: IntroFade = { value: 1 };

  private scene?: PrinterIntroScene;
  private timeline?: GSAPTimeline;
  private gsap?: Gsap;
  // Playback speed the presses have reached, kept for a timeline that is not built yet
  private speed = 1;
  private resizeObserver?: ResizeObserver;
  private watchdog?: ReturnType<typeof setTimeout>;
  private listeningVisibility = false;
  private listeningPointer = false;
  private landing = false;
  private startedEmitted = false;
  private revealEmitted = false;
  private doneEmitted = false;
  private destroyed = false;

  // Pointer target from the mouse, the eased value the scene gets, and the last paint time
  private pointerTx = 0;
  private pointerTy = 0;
  private pointerX = 0;
  private pointerY = 0;
  private lastPaint?: number;

  constructor() {
    // Browser only: nothing touches the canvas or the network during prerender
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  // Ends the intro now: the page is revealed (if it was not yet) and done fires
  protected skip(): void {
    this.finish();
  }

  // A press on the overlay speeds the intro up; the Skip button keeps its instant skip
  protected onPress(event: Event): void {
    if (this.finished() || this.onSkipButton(event)) return;
    this.speedUp();
  }

  // Enter and Space count as a press when the Skip button is not the target
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (this.finished() || this.onSkipButton(event)) return;
    event.preventDefault();
    // A held key is one press, not a stream of them
    if (!event.repeat) this.speedUp();
  }

  private onSkipButton(event: Event): boolean {
    return event.target instanceof Node && this.skipButton().nativeElement.contains(event.target);
  }

  // Raises the speed one step (up to the cap) and ramps the timeline to it; it stays raised
  private speedUp(): void {
    this.pressed.set(true);
    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_STEP);
    const timeline = this.timeline;
    if (!timeline || !this.gsap) return;
    // Overwriting drops an earlier ramp still in flight, so only the newest target applies
    this.gsap.to(timeline, {
      timeScale: this.speed,
      duration: SPEED_RAMP_S,
      ease: 'none',
      overwrite: true,
    });
  }

  // Esc skips unless something else already handled the key
  protected onEscape(event: Event): void {
    if (event.defaultPrevented) return;
    this.skip();
  }

  // Seam for tests: builds the three.js scene
  protected createScene(
    three: Three,
    roundedBox: RoundedBox,
    canvas: HTMLCanvasElement,
    options: PrinterIntroSceneOptions,
  ): PrinterIntroScene {
    return createPrinterIntroScene(three, roundedBox, canvas, options);
  }

  private init(): void {
    if (this.destroyed) return;
    // Reduced motion or no WebGL: skip everything and show the page at once
    if (!motionAllowed() || !webglAvailable()) {
      this.finish();
      return;
    }

    // Keyboard users start on the one control of the dialog, even before three.js has loaded
    this.skipButton().nativeElement.focus({ preventScroll: true });

    this.watchdog = setTimeout(() => {
      if (!this.startedEmitted) this.finish();
    }, WATCHDOG_MS);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.listeningVisibility = true;

    // Any failure while loading or building means no intro, never a stuck overlay
    this.load().catch(() => this.finish());
  }

  // True once the intro is over or the component is gone, so late async work stops
  private stopped(): boolean {
    return this.destroyed || this.doneEmitted;
  }

  private async load(): Promise<void> {
    const [three, rounded, gsapModule] = await Promise.all([
      import('three'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('gsap'),
    ]);
    // The page may have been left while the chunks were loading
    if (this.stopped()) return;

    const palette: IntroPalette = readIntroPalette();
    // Without a card there is nothing to copy or to land on, so the page is shown as it is
    const card = document.querySelector<HTMLElement>('[data-intro-target]');
    if (!card) {
      this.finish();
      return;
    }
    // The ticket is a picture of the card joined with its torn edge, modelled at the same proportions
    const texture = await createCardTexture(
      card,
      document.querySelector<HTMLElement>('[data-intro-edge]'),
    );
    if (this.stopped()) return;
    const receipt = texture.canvas;
    const paperAspect = ticketAspect(texture.aspect);

    const canvas = this.canvas().nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const scene = this.createScene(three, rounded.RoundedBoxGeometry, canvas, {
      dpr,
      palette,
      receipt,
      paperAspect,
    });
    this.scene = scene;
    this.size(canvas);
    this.observeSize(canvas);
    this.listenPointer();

    this.startedEmitted = true;
    clearTimeout(this.watchdog);
    this.started.emit();

    this.timeline = buildIntroTimeline(
      gsapModule.gsap,
      scene.state,
      {
        onFrame: () => this.paint(),
        onLand: () => this.startLanding(),
        onReveal: () => this.emitReveal(),
        onDone: () => this.finish(),
      },
      this.fadeState,
    );
    // Presses made while loading start the timeline already sped up
    this.gsap = gsapModule.gsap;
    this.timeline.timeScale(this.speed);
  }

  // Viewport rect of the real receipt card joined with its torn edge (card top to edge bottom),
  // or null when the card is missing or has no size; a missing edge leaves the card alone
  private measureTarget(): LandingRect | null {
    return unionRect(
      document.querySelector('[data-intro-target]')?.getBoundingClientRect(),
      document.querySelector('[data-intro-edge]')?.getBoundingClientRect(),
    );
  }

  // Points the scene at the card's current spot; the overlay is fixed full-screen, so viewport
  // coordinates match the canvas
  private updateLanding(): void {
    const canvas = this.canvas().nativeElement.getBoundingClientRect();
    this.scene?.setLanding(this.measureTarget(), {
      width: canvas.width || window.innerWidth,
      height: canvas.height || window.innerHeight,
    });
  }

  // The ticket is about to leave the printer: aim it, and keep aiming on resize
  private startLanding(): void {
    this.landing = true;
    this.updateLanding();
  }

  // Mouse sway for the camera and printer on fine pointers only; touch devices have no hover
  private listenPointer(): void {
    let fine = false;
    try {
      fine = window.matchMedia(FINE_POINTER).matches;
    } catch {
      fine = false;
    }
    if (!fine) return;
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    this.listeningPointer = true;
  }

  // Maps the pointer over the whole viewport to -1 .. 1 on each axis
  private readonly onPointer = (e: PointerEvent): void => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.pointerTx = Math.min(1, Math.max(-1, (e.clientX / w) * 2 - 1));
    this.pointerTy = Math.min(1, Math.max(-1, (e.clientY / h) * 2 - 1));
  };

  // Moves the eased pointer toward its target by an amount that does not depend on the frame rate
  private easePointer(): void {
    const now = performance.now();
    const gap = this.lastPaint === undefined ? 0 : now - this.lastPaint;
    const elapsed = Math.max(0, Math.min(MAX_FRAME_MS, gap));
    this.lastPaint = now;
    const k = 1 - Math.pow(1 - POINTER_EASE, elapsed / 16);
    this.pointerX += (this.pointerTx - this.pointerX) * k;
    this.pointerY += (this.pointerTy - this.pointerY) * k;
  }

  // Draws the current state and mirrors the fade value into the template
  private paint(): void {
    const scene = this.scene;
    if (!scene) return;
    // Only touched with a fine pointer; otherwise the scene keeps its centred default
    if (this.listeningPointer) {
      this.easePointer();
      scene.setPointer(this.pointerX, this.pointerY);
    }
    scene.apply();
    scene.render();
    if (this.fade() !== this.fadeState.value) this.fade.set(this.fadeState.value);
  }

  // Matches the render size to the canvas CSS size
  private size(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.scene?.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
  }

  private observeSize(canvas: HTMLCanvasElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => {
      this.size(canvas);
      // The card moves with the layout, so the landing spot follows it
      if (this.landing) this.updateLanding();
      // Resizing clears the buffer, so draw again
      this.paint();
    });
    this.resizeObserver.observe(canvas);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.finish();
  };

  private emitReveal(): void {
    if (this.destroyed || this.revealEmitted) return;
    this.revealEmitted = true;
    this.reveal.emit();
  }

  // The single exit: reveal first if needed, then done, once only
  private finish(): void {
    if (this.destroyed || this.doneEmitted) return;
    this.emitReveal();
    this.doneEmitted = true;
    this.finished.set(true);
    this.release();
    this.done.emit();
  }

  // Stops the timeline and frees everything the intro holds
  private release(): void {
    clearTimeout(this.watchdog);
    if (this.timeline) this.gsap?.killTweensOf(this.timeline);
    this.timeline?.kill();
    this.timeline = undefined;
    this.gsap = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.listeningVisibility) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.listeningVisibility = false;
    }
    if (this.listeningPointer) {
      window.removeEventListener('pointermove', this.onPointer);
      this.listeningPointer = false;
    }
    // Releases geometries, materials, textures and the GL context
    this.scene?.dispose();
    this.scene = undefined;
  }

  private teardown(): void {
    this.destroyed = true;
    this.release();
  }
}

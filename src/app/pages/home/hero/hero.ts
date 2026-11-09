import { Component, ElementRef, OnDestroy, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { Ahjoomah, AhjoomahMood } from '../../../shared/ahjoomah/ahjoomah';
import { animateMascot, bonk, squish, stopNudge } from '../../../shared/ahjoomah/mascot-motion';
import { AhjoomahSound } from '../../../shared/sound/ahjoomah-sound';
import { SoundToggle } from '../../../shared/sound/sound-toggle';
import { whenMotionAllowed } from '../../../shared/motion';
import { driftClouds } from '../../../shared/sky-clouds/sky-clouds';
import { HeroScene } from './hero-scene';

// How long her happy eyes last after a tap, in ms
const TAP_JOY_MS = 1200;
// How far (px) the nearest scene layer shifts toward the cursor; farther layers move less
const POINTER_SHIFT = 28;
// How far, as a fraction of the hero's height, a layer at depth 0 sinks while the hero scrolls
// away. Far layers (low depth) sink the most so they seem to hang back, near ones the least
const SCROLL_SHIFT = 0.5;
// When (s) she pops up in the intro: after the rooftop layer (starts at 0.6s, 1.1s long) is
// solid, so the wall is there to hide her before she rises from behind it
const MASCOT_POP_AT = 1.6;
// Input that skips the intro straight to its end
const SKIP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

// Home hero at dawn: a short headline and the reserve/menu CTAs, with Ahjoomah rising huge
// over the rooftops of a layered parallax scene (she stands on its stage, between the skyline
// and the rooftop wall). On first load a short intro raises the scene layer by layer, then the
// title, then pops her up from behind the wall with a greeting bonk;
// any scroll, tap or key skips it. After that the scene drifts with scroll (and with the
// cursor on desktop), clouds, smoke and lanterns idle gently, and she keeps her own life:
// bob, blink, eye-follow, idle routines and the Reserve nudge. Sound is opt-in only.
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, Ahjoomah, HeroScene, SoundToggle],
  templateUrl: './hero.html',
})
export class HomeHero implements OnDestroy {
  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly mascot = viewChild.required(Ahjoomah, { read: ElementRef });
  private readonly reserveCta = viewChild.required<ElementRef<HTMLElement>>('reserveCta');
  private readonly sound = inject(AhjoomahSound);
  private media?: gsap.MatchMedia;
  private pointerMedia?: gsap.MatchMedia;
  private visibility?: IntersectionObserver;
  private joyTimer?: ReturnType<typeof setTimeout>;
  // True only while the reduced-motion query allows animation
  private motionOn = false;

  // Open eyes that follow the cursor; closed happy arcs while Reserve is hovered or after a tap
  readonly mood = signal<AhjoomahMood>('open');

  constructor() {
    afterNextRender(() => {
      const el = this.section().nativeElement;

      // Grill sizzle ambience only while the hero is on screen (and only if sound is on)
      if (typeof IntersectionObserver !== 'undefined') {
        this.visibility = new IntersectionObserver(([entry]) => this.sound.ambience(entry.isIntersecting));
        this.visibility.observe(el);
      }

      this.media = whenMotionAllowed(() => {
        this.motionOn = true;
        const layers = gsap.utils.toArray<HTMLElement>('[data-layer]', el);
        // Anchored layers (the lanterns) skip scroll drift: a big scroll shift would pull the ends of
        // their string into view. They still follow the cursor, which moves them far less
        const drifting = layers.filter((layer) => !layer.hasAttribute('data-anchored'));
        const depth = (layer: HTMLElement) => Number(layer.dataset['depth'] ?? 0);
        const stopIntro = this.playIntro(el, layers, depth);
        this.startIdleScene(el);

        // Scroll: copy recedes; scene layers sink at their own speed for depth
        const scrub = { trigger: el, start: 'top top', end: 'bottom top', scrub: true };
        gsap.to(this.content().nativeElement, {
          scale: 0.92,
          yPercent: -8,
          opacity: 0,
          filter: 'blur(8px)',
          ease: 'none',
          scrollTrigger: scrub,
        });
        // Each layer's travel is set in hero heights, then converted to a % of its own height
        // (layers differ in height), and re-measured on resize
        drifting.forEach((layer) =>
          gsap.to(layer, {
            yPercent: () => ((1 - depth(layer)) * SCROLL_SHIFT * el.offsetHeight * 100) / layer.offsetHeight,
            ease: 'none',
            scrollTrigger: { ...scrub, invalidateOnRefresh: true },
          }),
        );

        const stopMascot = animateMascot(this.mascotEl(), { nudgeTarget: this.reserveCta().nativeElement });
        return () => {
          stopIntro();
          stopMascot();
          this.motionOn = false;
        };
      });

      // Cursor parallax: desktop pointers only, never under reduced motion
      this.pointerMedia = whenMotionAllowed(() => {
        const layers = gsap.utils.toArray<HTMLElement>('[data-layer]', el).map((layer) => ({
          d: Number(layer.dataset['depth'] ?? 0),
          x: gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3' }),
          y: gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3' }),
        }));
        let frame = 0;
        const onMove = (e: PointerEvent) => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            // -1..1 from the centre of the viewport; layers move away from the cursor
            const nx = (e.clientX / window.innerWidth) * 2 - 1;
            const ny = (e.clientY / window.innerHeight) * 2 - 1;
            layers.forEach((l) => {
              l.x(-nx * l.d * POINTER_SHIFT);
              l.y(-ny * l.d * POINTER_SHIFT * 0.5);
            });
          });
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
          window.removeEventListener('pointermove', onMove);
          cancelAnimationFrame(frame);
        };
      }, '(pointer: fine)');
    });
  }

  // First-look intro: scene rises far-to-near, title and CTAs follow, then she pops up and
  // greets with a bonk. Any scroll, tap or key jumps to the end. Returns its cleanup.
  private playIntro(el: HTMLElement, layers: HTMLElement[], depth: (l: HTMLElement) => number): () => void {
    const byDepth = [...layers].sort((a, b) => depth(a) - depth(b));
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    byDepth.forEach((layer, i) => {
      const part = layer.querySelector('[data-intro]');
      if (!part) return;
      // Anchored layers fade in place; the rest rise into position
      const rise = layer.hasAttribute('data-anchored') ? 0 : 30 + depth(layer) * 40;
      tl.from(part, { yPercent: rise, opacity: 0, duration: 1.1 }, i * 0.12);
    });
    tl.from(
      el.querySelectorAll('[data-lantern] [data-swing]'),
      { rotation: 28, transformOrigin: '50% 0%', duration: 1.6, ease: 'elastic.out(1, 0.35)', stagger: 0.08 },
      0.5,
    )
      .from(el.querySelector('[data-intro="eyebrow"]'), { y: 14, opacity: 0, duration: 0.6 }, 0.45)
      .from(el.querySelector('[data-intro="title"]'), { y: 30, opacity: 0, duration: 0.8 }, 0.6)
      .from(el.querySelector('[data-intro="ctas"]'), { y: 20, opacity: 0, duration: 0.7 }, 1.0)
      // She stays hidden until the rooftops have fully risen in front of her (the template
      // hides her before hydration too), then pops up from behind the wall and greets the visitor
      .set(this.mascotEl(), { autoAlpha: 0 }, 0)
      .set(this.mascotEl(), { autoAlpha: 1 }, MASCOT_POP_AT)
      .from(this.mascotEl(), { yPercent: 75, duration: 0.8, ease: 'back.out(1.8)' }, MASCOT_POP_AT)
      .call(() => this.sound.play('pop'), [], MASCOT_POP_AT + 0.05)
      .call(
        () => {
          bonk(this.mascotEl());
          this.sound.play('bonk');
        },
        [],
        MASCOT_POP_AT + 0.8,
      );

    const removeSkip = () => SKIP_EVENTS.forEach((type) => window.removeEventListener(type, skip));
    const skip = () => {
      if (tl.progress() < 1) tl.progress(1);
      removeSkip();
    };
    SKIP_EVENTS.forEach((type) => window.addEventListener(type, skip, { passive: true }));
    tl.eventCallback('onComplete', removeSkip);
    return removeSkip;
  }

  // Gentle idle loops: clouds drift and morph, chimney smoke rises, lanterns sway
  private startIdleScene(el: HTMLElement): void {
    driftClouds(el);
    gsap.utils.toArray<SVGCircleElement>('[data-smoke] circle', el).forEach((puff, i) => {
      gsap.fromTo(
        puff,
        { y: 0, x: 0, scale: 0.6, opacity: 0.7, transformOrigin: '50% 50%' },
        {
          y: -90,
          x: gsap.utils.random(10, 30),
          scale: 2.2,
          opacity: 0,
          duration: 4.2,
          ease: 'sine.out',
          repeat: -1,
          delay: i * 1.4,
        },
      );
    });
    gsap.utils.toArray<SVGGElement>('[data-lantern] [data-swing]', el).forEach((swing, i) => {
      gsap.to(swing, {
        rotation: i % 2 ? -4 : 4,
        transformOrigin: '50% 0%',
        duration: 2.4 + i * 0.35,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 2 + i * 0.2,
      });
    });
  }

  // Reserve hover/focus: happy eyes always, plus a squish and a soft ding when allowed
  cheer(on: boolean): void {
    this.mood.set(on ? 'happy' : 'open');
    if (!on) return;
    this.sound.play('ding');
    if (this.motionOn) squish(this.mascotEl());
  }

  // Tap on Ahjoomah: brief happy eyes, a bonk-and-hop when motion is allowed, and no more nudges
  tap(): void {
    this.mood.set('happy');
    clearTimeout(this.joyTimer);
    this.joyTimer = setTimeout(() => this.mood.set('open'), TAP_JOY_MS);
    this.sound.play('bonk');
    if (this.motionOn) {
      stopNudge(this.mascotEl());
      bonk(this.mascotEl());
    }
  }

  private mascotEl(): HTMLElement {
    return this.mascot().nativeElement as HTMLElement;
  }

  ngOnDestroy(): void {
    clearTimeout(this.joyTimer);
    this.visibility?.disconnect();
    this.sound.ambience(false);
    this.media?.revert();
    this.pointerMedia?.revert();
  }
}

import { Component, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { gsap } from 'gsap';
import { whenMotionAllowed } from '../../shared/motion';
import { SkyClouds, driftClouds } from '../../shared/sky-clouds/sky-clouds';

// Seconds the entrance takes, start to finish
const ENTRANCE_S = 0.9;
// How far the sun travels with scroll, and its glow pulse length (s)
const SUN_PARALLAX = 0.2;
const GLOW_PULSE_S = 7;

// Menu header on golden sky: a sun sinking behind the horizon, the home hero's drifting clouds,
// the title with a brush underline and a red 메뉴 seal. With motion allowed the sun rises and the
// copy fades up once on load, the brush line draws itself, the sun glows slowly, and the sun
// and clouds shift at their own rates while the page scrolls over the header. Without motion (or without JS) the
// finished layout is simply there: every hidden start state is set by the tweens, never by CSS.
@Component({
  selector: 'app-menu-header',
  imports: [SkyClouds],
  templateUrl: './menu-header.html',
  host: { class: 'block' },
})
export class MenuHeader implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private media?: gsap.MatchMedia;

  constructor() {
    afterNextRender(() => {
      // Some environments (jsdom) have no matchMedia; the header then stays static
      if (typeof window.matchMedia !== 'function') {
        return;
      }
      const root = this.host.nativeElement;
      this.media = whenMotionAllowed(() => this.build(root));
    });
  }

  // All header tweens; created together so one MatchMedia revert removes them
  private build(root: HTMLElement): void {
    const header = root.querySelector<HTMLElement>('[data-header]');
    const sunRise = root.querySelector<HTMLElement>('[data-sun-rise]');
    const glow = root.querySelector<HTMLElement>('[data-sun-glow]');
    const brush = root.querySelector<SVGPathElement>('[data-brush]');
    if (!header || !sunRise || !glow || !brush) {
      return;
    }

    // Entrance: sun rises from below the horizon, then the copy fades up in a short stagger
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.from(sunRise, { y: 120, duration: ENTRANCE_S }, 0);
    tl.from(
      gsap.utils.toArray<HTMLElement>('[data-enter]', root),
      { opacity: 0, y: 18, duration: 0.5, stagger: 0.1 },
      0.1,
    );
    // Brush underline draws in (the path is 1 unit long via pathLength)
    tl.from(brush, { strokeDashoffset: 1, duration: 0.5, ease: 'power1.inOut' }, 0.4);

    // Living sun: the glow breathes slowly once the entrance is done
    gsap.fromTo(
      glow,
      { opacity: 0.45, scale: 1 },
      {
        opacity: 0.85,
        scale: 1.12,
        duration: GLOW_PULSE_S,
        delay: ENTRANCE_S,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      },
    );

    // Clouds drift across the sky and wrap around, as on the home hero
    driftClouds(root);

    // Parallax over the header's own height only: the sun and each cloud sink at their own rate
    const scrub = { trigger: header, start: 'top top', end: 'bottom top', scrub: true };
    gsap.utils.toArray<HTMLElement>('[data-parallax]', root).forEach((layer) => {
      const rate = Number(layer.dataset['parallax'] ?? SUN_PARALLAX);
      gsap.to(layer, {
        y: () => header.offsetHeight * rate,
        ease: 'none',
        scrollTrigger: scrub,
      });
    });
  }

  ngOnDestroy(): void {
    // Kills the tweens and ScrollTriggers this header made
    this.media?.revert();
  }
}

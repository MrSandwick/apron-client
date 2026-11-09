import { Component } from '@angular/core';
import { gsap } from 'gsap';

// The cloud SVG's viewBox width, which the drift wraps around
const SKY_WIDTH = 1440;
// How far past either edge a cloud travels before it wraps
const WRAP_MARGIN = 40;

// The sky's flat clouds, shared by the home hero and the menu header so both skies match.
// Pure markup: the host page sizes it and calls driftClouds() inside its own motion build.
@Component({
  selector: 'app-sky-clouds',
  templateUrl: './sky-clouds.html',
  host: { class: 'block', 'aria-hidden': 'true' },
})
export class SkyClouds {}

// Clouds travel the full width of the sky and wrap around, so the sky is always changing.
// Speed follows size (bigger means nearer and faster), each cloud also bobs gently, and its
// puffs swell and shrink out of step, so the shape shifts as it goes. Call from a motion build
// (browser only) so the tweens are reverted with it.
export function driftClouds(el: HTMLElement): void {
  gsap.utils.toArray<SVGGElement>('[data-cloud]', el).forEach((cloud) => {
    // getBBox is missing in some non-browser environments; skip drifting there
    if (typeof cloud.getBBox !== 'function') return;
    const box = cloud.getBBox();
    const from = -(box.x + box.width) - WRAP_MARGIN;
    const to = SKY_WIDTH - box.x + WRAP_MARGIN;
    // Slow on purpose: a big cloud takes well over a minute to cross, so it reads as drifting
    const speed = 7 + box.width * 0.05; // viewBox units per second
    const drift = gsap.fromTo(
      cloud,
      { x: from },
      { x: to, duration: (to - from) / speed, ease: 'none', repeat: -1 },
    );
    // Start where the cloud is drawn rather than off the left edge
    drift.progress((0 - from) / (to - from));

    gsap.to(cloud, {
      y: gsap.utils.random(-9, 9),
      duration: gsap.utils.random(5, 9),
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    cloud.querySelectorAll('ellipse').forEach((puff) => {
      gsap.to(puff, {
        scaleX: gsap.utils.random(1.06, 1.16),
        scaleY: gsap.utils.random(0.86, 0.94),
        transformOrigin: '50% 50%',
        duration: gsap.utils.random(4, 8),
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: gsap.utils.random(0, 3),
      });
    });
  });
}

import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input, numberAttribute } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Scroll-triggered entrance: fades and lifts an element into place the first time it
// scrolls into view, powered by GSAP + ScrollTrigger. SSR-safe - GSAP only runs in the
// browser (afterNextRender), so prerendered / no-JS content renders visible and is never
// hidden - and motion-safe: gsap.matchMedia only builds the animation under
// prefers-reduced-motion: no-preference, leaving reduced-motion users the static layout.
// Optional `appReveal` value staggers the entrance (ms) to sequence a group.
@Directive({
  selector: '[appReveal]',
})
export class Reveal implements OnDestroy {
  // Stagger before this element's entrance, in ms (used to sequence a group)
  readonly delay = input(0, { alias: 'appReveal', transform: numberAttribute });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private media?: gsap.MatchMedia;

  constructor() {
    // Browser-only: GSAP + ScrollTrigger never run during prerender/SSR
    afterNextRender(() => this.animate());
  }

  private animate(): void {
    gsap.registerPlugin(ScrollTrigger); // idempotent; needed before ScrollTrigger use
    const el = this.host.nativeElement;

    // Build the entrance only when motion is allowed; reduced-motion users keep the
    // static layout (matchMedia simply never runs the callback for them).
    this.media = gsap.matchMedia();
    this.media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(el, {
        opacity: 0,
        y: 24,
        duration: 0.7,
        ease: 'power2.out',
        delay: this.delay() / 1000,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%', // fire as the element's top passes 85% down the viewport
          once: true, // one-shot: reveal only the first time
        },
      });
    });
  }

  ngOnDestroy(): void {
    // Revert tweens + kill the ScrollTriggers created for this element
    this.media?.revert();
  }
}

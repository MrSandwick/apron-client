import { Component, ElementRef, OnDestroy, afterNextRender, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { whenMotionAllowed } from '../../../shared/motion';
import { DishArt, DishKind } from '../../../shared/dish-art/dish-art';
import { VoiceBubble } from '../../../shared/voice-bubble/voice-bubble';

// Home steps: "how a night goes", told in four rounds, and the page's sunset. From md up
// with motion allowed, the section pins below the navbar while each round takes over the
// stage; the sky scrubs from afternoon to twilight, the sun sinks and reddens, and the
// heading flips from ink to light at dusk. Phones, reduced-motion and prerendered/no-JS
// visitors get the same rounds as a static list over the same gradient.
@Component({
  selector: 'app-home-steps',
  imports: [DishArt, VoiceBubble],
  templateUrl: './steps.html',
})
export class HomeSteps implements OnDestroy {
  // Placeholder copy; swap for final wording. `dish` picks the illustration in each round's image slot.
  readonly rounds: { title: string; body: string; dish: DishKind }[] = [
    { title: 'Grab a table', body: 'Book online in under two minutes, or just walk in. Groups of 2 to 30 welcome.', dish: 'rice' },
    { title: 'Pick your cuts', body: 'Marinated galbi, pork belly, brisket. Order by the plate or go unlimited on weekends.', dish: 'meat' },
    { title: 'Fire up the grill', body: 'Cook it your way at the table, or let our staff grill it to the perfect char.', dish: 'grill' },
    { title: 'Keep it coming', body: 'Refills on banchan, a round of soju, and something sweet to finish the night.', dish: 'banchan' },
  ];

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly sun = viewChild.required<ElementRef<HTMLElement>>('sun');
  private readonly lead = viewChild.required<ElementRef<HTMLElement>>('lead');
  private media?: gsap.MatchMedia;

  constructor() {
    afterNextRender(() => {
      this.media = whenMotionAllowed(() => {
        const el = this.section().nativeElement;
        const cards = gsap.utils.toArray<HTMLElement>('[data-round]', el);
        const counters = gsap.utils.toArray<HTMLElement>('[data-counter]', el);
        const token = (name: string) =>
          getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
        const steps = cards.length - 1;

        // Switch the stage into stacked mode: rounds overlap, only the first shows, and the
        // static gradient gives way to a single sky colour the timeline can scrub
        el.classList.add('is-pinned');
        gsap.set(el, { backgroundImage: 'none', backgroundColor: token('sky-afternoon') });
        gsap.set(cards.slice(1), { autoAlpha: 0, yPercent: 30 });
        gsap.set(counters.slice(1), { yPercent: 100 });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut', duration: 1 },
          scrollTrigger: {
            trigger: el,
            // Pin just below the sticky navbar (64px bar + 1px border) so nothing hides under it
            start: 'top 65px',
            end: () => `+=${window.innerHeight * steps * 0.9}`,
            pin: true,
            scrub: 0.6,
            snap: { snapTo: 1 / steps, duration: 0.4, ease: 'power1.inOut' },
            invalidateOnRefresh: true,
          },
        });

        // Sky: afternoon at round 1 through to twilight at round 4
        tl.to(
          el,
          {
            keyframes: {
              backgroundColor: ['sky-afternoon', 'sky-golden', 'sky-sunset', 'sky-dusk', 'sky-twilight'].map(token),
            },
            ease: 'none',
            duration: steps,
          },
          0,
        );
        // Sun sinks below the bottom edge and reddens as it goes
        tl.to(
          this.sun().nativeElement,
          { yPercent: 320, '--sun-c': token('sun-set'), ease: 'power1.in', duration: steps },
          0,
        );
        // Heading, counter and rail flip from ink to light between rounds 2 and 3
        tl.to(this.lead().nativeElement, { color: token('night-text'), ease: 'none', duration: 0.6 }, 1.2);
        tl.to(el.querySelector('[data-rail]'), { scaleX: 1, ease: 'none', duration: steps }, 0);
        cards.forEach((card, i) => {
          if (i === 0) return;
          const at = i - 1;
          tl.to(cards[i - 1], { autoAlpha: 0, yPercent: -30, scale: 0.94 }, at)
            .to(card, { autoAlpha: 1, yPercent: 0 }, at)
            .to(counters[i - 1], { yPercent: -100 }, at)
            .to(counters[i], { yPercent: 0 }, at);
        });

        return () => el.classList.remove('is-pinned');
      }, '(min-width: 768px) and (min-height: 640px)');
    });
  }

  ngOnDestroy(): void {
    this.media?.revert();
  }
}

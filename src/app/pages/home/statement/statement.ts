import { Component, ElementRef, OnDestroy, afterNextRender, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { whenMotionAllowed } from '../../../shared/motion';

// Home statement: one large line of brand copy whose words light up in reading
// order as the section scrolls through the viewport (scrubbed, so it reverses on
// scroll-up). Words are split in the template rather than the DOM, so prerendered
// HTML already has them and no-JS / reduced-motion visitors simply see full text.
@Component({
  selector: 'app-home-statement',
  templateUrl: './statement.html',
})
export class HomeStatement implements OnDestroy {
  // Placeholder brand copy; swap for the final line when it's written.
  readonly text =
    'Charcoal on the grill, jjigae bubbling at the table and banchan that keeps on coming. A Seoul night out, served in Chicago.';
  // Words rendered in the accent colour once lit
  private readonly accent = new Set(['Seoul', 'night', 'out,']);

  readonly words = this.text.split(' ').map((word) => ({ word, accent: this.accent.has(word) }));

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private media?: gsap.MatchMedia;

  constructor() {
    afterNextRender(() => {
      this.media = whenMotionAllowed(() => {
        const el = this.section().nativeElement;
        gsap.fromTo(
          el.querySelectorAll('[data-word]'),
          { opacity: 0.14 },
          {
            opacity: 1,
            ease: 'none',
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: 'top 70%', end: 'bottom 55%', scrub: true },
          },
        );
      });
    });
  }

  ngOnDestroy(): void {
    this.media?.revert();
  }
}

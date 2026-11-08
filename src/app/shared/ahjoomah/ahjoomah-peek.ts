import { Component, ElementRef, OnDestroy, afterNextRender, input, viewChild } from '@angular/core';
import { gsap } from 'gsap';
import { Ahjoomah, AhjoomahMood } from './ahjoomah';
import { animateMascot } from './mascot-motion';
import { whenMotionAllowed } from '../motion';

// Ahjoomah peeking over an edge: the frame clips her below the shoulders, so she looks
// like she's leaning up from behind whatever the host places her on. With motion
// allowed she ducks out of sight and pops up when the frame scrolls into view (and
// hides again on scroll-back); otherwise she simply sits in the peek position.
@Component({
  selector: 'app-ahjoomah-peek',
  imports: [Ahjoomah],
  template: `
    <!-- Clipping frame: shows roughly her head and shoulders -->
    <div #frame class="aspect-[200/150] overflow-hidden" data-testid="ahjoomah-peek">
      <div #figure class="will-change-transform">
        <app-ahjoomah [mood]="mood()" [decorative]="true" />
      </div>
    </div>
  `,
  host: { class: 'block pointer-events-none' },
})
export class AhjoomahPeek implements OnDestroy {
  readonly mood = input<AhjoomahMood>('open');

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly figure = viewChild.required<ElementRef<HTMLElement>>('figure');
  private media?: gsap.MatchMedia;

  constructor() {
    afterNextRender(() => {
      this.media = whenMotionAllowed(() => {
        const frame = this.frame().nativeElement;
        // Pop up from below the edge with a little overshoot
        gsap.from(this.figure().nativeElement, {
          yPercent: 75,
          duration: 0.8,
          ease: 'back.out(1.8)',
          scrollTrigger: {
            trigger: frame,
            start: 'top 92%',
            toggleActions: 'play none none reverse',
          },
        });
        // Peeks only bob, blink and follow the cursor; idle moves and the nudge are hero-only
        return animateMascot(frame, { idle: false });
      });
    });
  }

  ngOnDestroy(): void {
    this.media?.revert();
  }
}

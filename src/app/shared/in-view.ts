import {
  Directive,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { motionAllowed } from './motion';

// Marks a block as "armed" until it scrolls into view, then flips it to "in" once. It only
// sets `data-state`; the template's `armed:` classes do the hiding and the transitions, so a
// section can stagger masked lines, fades and rows from one trigger. SSR-safe: nothing runs
// on the server, so prerendered HTML is fully visible, and under reduced motion (or without
// IntersectionObserver) the attribute is never set, which leaves the final state showing.
@Directive({
  selector: '[appInView]',
})
export class InView implements OnDestroy {
  // Share of the block that must be visible before it flips to "in"
  // An empty attribute (plain `appInView`) falls back to 0.2 instead of becoming NaN
  readonly threshold = input(0.2, {
    alias: 'appInView',
    transform: (value: unknown) => numberAttribute(value, 0.2),
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => this.watch());
  }

  private watch(): void {
    if (!motionAllowed() || typeof IntersectionObserver === 'undefined') return;
    const el = this.host.nativeElement;

    // On screen or already scrolled past at load (e.g. a reload mid-page): stay visible, don't
    // hide then replay
    if (el.getBoundingClientRect().top < window.innerHeight * 0.8) {
      el.dataset['state'] = 'in';
      return;
    }

    // Below the fold: hide now, reveal the first time enough of it is visible
    el.dataset['state'] = 'armed';
    const reveal = (): void => {
      el.dataset['state'] = 'in';
      this.stop();
    };
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) reveal();
      },
      { threshold: this.threshold() },
    );
    this.observer.observe(el);
    // A jump straight past the block (anchor link, fast fling) never crosses the threshold, so
    // the observer stays silent; reveal anything that has ended up above the viewport bottom
    this.onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight) reveal();
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  private onScroll?: () => void;

  private stop(): void {
    this.observer?.disconnect();
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
    this.onScroll = undefined;
  }

  ngOnDestroy(): void {
    this.stop();
  }
}

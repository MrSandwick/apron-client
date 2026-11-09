import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  input,
} from '@angular/core';
import { gsap } from 'gsap';
import { whenMotionAllowed } from '../../shared/motion';

// Which piece of decor to draw; each kind positions itself inside its parent's box
export type MenuDecorKind = 'eave';

// Which page edge a margin piece belongs to
export type MenuDecorSide = 'left' | 'right';

// Decor for the menu's side margins from xl: hanok eaves with hanging paper lanterns on the
// heading bars. Everything is inline SVG in a pointer-events-none, aria-hidden layer that the
// parent anchors (the parent supplies a `relative` box). The lantern sway runs only when the
// visitor allows motion, in the browser, and is reverted on destroy.
@Component({
  selector: 'app-menu-decor',
  imports: [NgTemplateOutlet],
  templateUrl: './menu-decor.html',
  host: {
    'aria-hidden': 'true',
    'data-testid': 'menu-decor',
    '[class]': 'hostClass()',
  },
})
export class MenuDecor implements OnDestroy {
  readonly kind = input.required<MenuDecorKind>();
  // The page edge a margin kind belongs to (ignored by the others)
  readonly side = input<MenuDecorSide>('right');

  // The eave is drawn with its tip on the right, so the left margin mirrors it
  protected readonly flip = computed(() => this.side() === 'left');

  // Two lanterns hang from an eave: one always, the second once the eave has grown (2xl).
  // Positions count from the eave's inner end (behind the bar), so they mirror with the side
  protected readonly lanterns = computed(() => {
    const left = this.side() === 'left';
    return [
      { at: left ? 'right-[42%] 2xl:right-[32%]' : 'left-[42%] 2xl:left-[32%]' },
      { at: left ? 'hidden right-[62%] 2xl:block' : 'hidden left-[62%] 2xl:block' },
    ];
  });

  // Beside a heading bar, in a wrapper: starts 2rem behind the bar's outer edge and below its top
  // edge, so the roof's flat end stays hidden; sticks out 4rem at xl (2xl: 6rem)
  protected readonly hostClass = computed(
    () =>
      'pointer-events-none absolute top-3 hidden w-24 xl:block 2xl:w-32 ' +
      (this.side() === 'left' ? 'right-full -mr-8' : 'left-full -ml-8'),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private media?: gsap.MatchMedia;

  constructor() {
    afterNextRender(() => {
      // Some environments (jsdom) have no matchMedia; the decor then simply stays still
      if (typeof window.matchMedia !== 'function') {
        return;
      }
      const el = this.host.nativeElement;
      // Margin pieces only exist from xl, so only animate them there
      this.media = whenMotionAllowed(() => this.animate(el), '(min-width: 1280px)');
    });
  }

  // Builds every tween for the pieces this kind drew, driven by data attributes in the template
  private animate(el: HTMLElement): void {
    const all = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, el);

    // Lanterns sway a degree or two from the string and breathe their glow
    all('[data-sway]').forEach((lantern) =>
      gsap.fromTo(
        lantern,
        { rotation: -2, transformOrigin: '50% 0%' },
        { rotation: 2, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 },
      ),
    );
    all('[data-glow]').forEach((glow) =>
      gsap.fromTo(
        glow,
        { opacity: 0.3 },
        { opacity: 0.55, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 },
      ),
    );
  }

  ngOnDestroy(): void {
    // Kills every tween the decor made
    this.media?.revert();
  }
}

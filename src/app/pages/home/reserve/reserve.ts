import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionCanvas } from '../../../three/section-canvas/section-canvas';
import { InView } from '../../../shared/in-view';
import { VoiceBubble } from '../../../shared/voice-bubble/voice-bubble';
import { motionAllowed, onScrollFrame, sectionProgress } from '../../../shared/motion';

// How far each backdrop layer drifts with scroll, as a share of 400px (negative moves the
// other way, so the glow and the word separate)
const POOL_PARALLAX = 0.35;
const WORD_PARALLAX = -0.9;
const PARALLAX_RANGE = 400;
// Same as Tailwind's md breakpoint, where the strong phone veil (md:hidden) switches off
const WIDE_QUERY = '(min-width: 768px)';

// Home reserve: booking pitch, feature list, and the reserve CTA, beside three 3D soju bottles
// at different depths (one big bottle on phones, as before the redesign). From md up the amber
// glow and the faint 소주 word drift with scroll; phones and reduced motion leave them still.
@Component({
  selector: 'app-home-reserve',
  imports: [RouterLink, SectionCanvas, InView, VoiceBubble],
  templateUrl: './reserve.html',
})
export class HomeReserve {
  // Bullet points shown beside the booking copy.
  readonly features = [
    'Available 7 days a week',
    'Instant confirmation by email',
    'Groups of 2 – 30 guests',
    'Special occasions & private dining',
  ];

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly pool = viewChild.required<ElementRef<HTMLElement>>('pool');
  private readonly word = viewChild.required<ElementRef<HTMLElement>>('word');
  private readonly destroyRef = inject(DestroyRef);

  // Whether the screen is md or wider; unknown (no canvas) until the browser has rendered
  readonly wide = signal<boolean | undefined>(undefined);

  constructor() {
    afterNextRender(() => {
      // Pick the bottle layout for this screen, and follow it if the window is resized across md
      // (no matchMedia, as in some test DOMs, falls back to the wide layout)
      if (typeof window.matchMedia !== 'function') {
        this.wide.set(true);
      } else {
        const query = window.matchMedia(WIDE_QUERY);
        this.wide.set(query.matches);
        const onChange = (event: MediaQueryListEvent) => this.wide.set(event.matches);
        query.addEventListener('change', onChange);
        this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
      }

      // Scroll motion is skipped under reduced motion so the layers stay at rest
      if (!motionAllowed()) return;
      this.destroyRef.onDestroy(onScrollFrame(this.section().nativeElement, () => this.frame()));
    });
  }

  // One scroll frame: shift each backdrop layer by its own speed (wide screens only)
  private frame(): void {
    if (!this.wide()) {
      this.pool().nativeElement.style.transform = '';
      this.word().nativeElement.style.transform = '';
      return;
    }
    const progress = sectionProgress(this.section().nativeElement);
    const shift = (parallax: number) =>
      `translateY(${((progress - 0.5) * PARALLAX_RANGE * parallax).toFixed(1)}px)`;
    this.pool().nativeElement.style.transform = shift(POOL_PARALLAX);
    this.word().nativeElement.style.transform = shift(WORD_PARALLAX);
  }
}

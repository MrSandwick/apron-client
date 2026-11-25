import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { InView } from '../../../shared/in-view';
import { AhjoomahPeek } from '../../../shared/ahjoomah/ahjoomah-peek';
import { motionAllowed, onScrollFrame, sectionProgress } from '../../../shared/motion';

// The restaurant's own timezone: "today" and "open now" follow Chicago, not the visitor's clock
const TIME_ZONE = 'America/Chicago';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Weekday (0 = Sunday, like Date#getDay) and minutes since midnight in Chicago at `date`
export function chicagoClock(date: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAYS.indexOf(part('weekday')),
    // % 24 guards engines that print midnight as "24"
    minutes: (Number(part('hour')) % 24) * 60 + Number(part('minute')),
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Home visit, in the evening part of the page: one panel with the Chicago location (address,
// actions) beside the opening hours, just before Reserve, where visitors decide whether to
// come tonight. Scroll motion (panel settle, drifting word) is browser-only and skipped under reduced motion, which shows the final state.
@Component({
  selector: 'app-home-visit',
  imports: [InView, AhjoomahPeek],
  templateUrl: './visit.html',
})
export class HomeVisit {
  // The restaurant's location, shown in the left half of the panel. It is the only one, in
  // Chicago; the address is a placeholder until real data exists.
  readonly locations = [{ city: 'Chicago', address: '123 Lorem St, Chicago IL 00000' }];

  // Opening hours; `days` uses Date#getDay() numbering (0 = Sunday) to highlight today
  readonly hours = [
    { label: 'Mon – Thu', time: '11:00 AM – 10:00 PM', days: [1, 2, 3, 4] },
    { label: 'Fri – Sat', time: '11:00 AM – 12:00 AM', days: [5, 6] },
    { label: 'Sunday', time: '12:00 PM – 9:00 PM', days: [0] },
  ];

  // Chicago weekday and time. Set in the browser only, so prerendered HTML never bakes in the build time.
  private readonly now = signal<{ day: number; minutes: number } | null>(null);

  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');
  private readonly drift = viewChild.required<ElementRef<HTMLElement>>('drift');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      // Keep today's row fresh while the page stays open
      this.now.set(chicagoClock(new Date()));
      const timer = setInterval(() => this.now.set(chicagoClock(new Date())), 60_000);
      this.destroyRef.onDestroy(() => clearInterval(timer));

      // Reduced motion: no scroll work at all, final state stays
      if (!motionAllowed()) return;
      this.destroyRef.onDestroy(onScrollFrame(this.section().nativeElement, () => this.frame()));
    });
  }

  isToday(days: number[]): boolean {
    const now = this.now();
    return now !== null && days.includes(now.day);
  }

  // One scroll frame: everything here is a pure function of how far the section has travelled
  private frame(): void {
    const pv = sectionProgress(this.section().nativeElement);

    // Giant word slides sideways the whole time the section is on screen
    this.drift().nativeElement.style.transform = `translateX(${(pv * -40).toFixed(2)}%)`;

    // Panel settles from slightly lower and smaller into place
    const settle = clamp01((pv - 0.12) / 0.3);
    this.panel().nativeElement.style.transform = `translateY(${((1 - settle) * 80).toFixed(1)}px) scale(${(0.94 + settle * 0.06).toFixed(4)})`;
  }
}

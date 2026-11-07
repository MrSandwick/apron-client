import { Component, afterNextRender, signal } from '@angular/core';
import { Reveal } from '../../../shared/reveal';
import { AhjoomahPeek } from '../../../shared/ahjoomah/ahjoomah-peek';

// Home visit, in the evening part of the page: Find Us locations and opening hours,
// just before Reserve, where visitors decide whether to come tonight.
@Component({
  selector: 'app-home-visit',
  imports: [Reveal, AhjoomahPeek],
  templateUrl: './visit.html',
})
export class HomeVisit {
  // Restaurant locations shown as cards under "Find Us" (placeholders until real data exists).
  readonly locations = [
    { city: 'Lorem City', address: '123 Lorem St, Ipsum NY 00000', phone: '(000) 000-0000' },
    { city: 'Dolor City', address: '456 Dolor Ave, Sit CA 00000', phone: '(000) 000-0000' },
  ];

  // Opening hours; `days` uses Date#getDay() numbering (0 = Sunday) to highlight today.
  readonly hours = [
    { label: 'Mon – Thu', time: '11:00 AM – 10:00 PM', days: [1, 2, 3, 4] },
    { label: 'Fri – Sat', time: '11:00 AM – 12:00 AM', days: [5, 6] },
    { label: 'Sunday', time: '12:00 PM – 9:00 PM', days: [0] },
  ];

  // Visitor's weekday. Set in the browser only, so prerendered HTML never bakes in the build day.
  private readonly today = signal<number | null>(null);

  constructor() {
    afterNextRender(() => this.today.set(new Date().getDay()));
  }

  isToday(days: number[]): boolean {
    const today = this.today();
    return today !== null && days.includes(today);
  }
}

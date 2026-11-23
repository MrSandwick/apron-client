import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeVisit, chicagoClock } from './visit';

// Renders the section and lets afterNextRender (the browser-only clock) run
async function render() {
  const fixture = TestBed.createComponent(HomeVisit);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

// Pins the system clock without touching timers, so rendering still settles
function setNow(iso: string): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

describe('HomeVisit', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeVisit] }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  // The one Chicago location renders, and Hours is a description list with one row per span
  it('renders the Chicago location and an Hours list', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-visit"]')).toBeTruthy();
    const text = el.textContent ?? '';
    expect(text).toContain('Chicago');
    expect(text).toContain('123 Lorem St');
    expect(text).not.toContain('New York');
    expect(text).not.toContain('Los Angeles');
    expect(el.querySelectorAll('[data-testid="hours-list"] > div').length).toBe(3);
    expect(text).toContain('Mon – Thu');
    expect(text).toContain('Sunday');
  });

  // Heading is two masked lines with the second in amber, plus the lead paragraph
  it('renders the two-line heading and the lead paragraph', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const h2 = el.querySelector('h2');
    expect(h2?.textContent).toContain('Come find');
    expect(h2?.textContent).toContain('us tonight');
    expect(h2?.querySelector('.text-brand-amber')?.textContent).toContain('us tonight');
    expect(el.textContent).toContain('The lanterns are lit');
  });

  // No map or phone links yet, so both actions stay buttons sized as 44px tap targets
  it('keeps Get Directions and Call as placeholder buttons with a full tap target', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    const directions = buttons.filter((b) => b.textContent?.includes('Get Directions'));
    const call = buttons.filter((b) => b.textContent?.trim() === 'Call');
    expect(directions.length).toBe(1);
    expect(call.length).toBe(1);
    expect([...directions, ...call].every((b) => b.classList.contains('min-h-11'))).toBe(true);
    // Flagged as unavailable to assistive tech, but still visible and focusable
    expect([...directions, ...call].every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(
      true,
    );
    expect([...directions, ...call].some((b) => b.disabled)).toBe(false);
    expect(directions[0].classList.contains('btn-primary')).toBe(true);
    expect(call[0].classList.contains('btn-ghost')).toBe(true);
  });

  // The map is an illustrated frame with a pin, and the giant word behind the section is decorative
  it('renders the map with its pin and a hidden drifting word', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="img"] svg')).toBeTruthy();
    const drift = el.querySelector('[data-testid="visit-drift"]');
    expect(drift?.getAttribute('aria-hidden')).toBe('true');
    expect(drift?.textContent).toContain('찾아오세요');
  });

  // Today's row gets the badge once the browser knows the weekday (Sunday in Chicago)
  it('marks today in the hours once rendered in the browser', async () => {
    setNow('2026-11-22T21:00:00Z');
    const { el } = await render();
    const rows = el.querySelectorAll('[data-testid="hours-list"] > div');
    expect(rows[2].textContent).toContain('Today');
    expect(rows[0].textContent).not.toContain('Today');
  });

  // Inside opening hours the pill says when the kitchen closes (Sunday 3 PM in Chicago)
  it('shows "Open now" with the closing time while open', async () => {
    setNow('2026-11-22T21:00:00Z');
    const { el } = await render();
    expect(el.querySelector('[data-testid="open-status"]')?.textContent).toContain(
      'Open now · until 9 PM',
    );
  });

  // After closing time the pill switches to the closed state (Sunday 10 PM in Chicago)
  it('shows "Closed now" outside opening hours', async () => {
    setNow('2026-11-23T04:00:00Z');
    const { el } = await render();
    expect(el.querySelector('[data-testid="open-status"]')?.textContent).toContain('Closed now');
  });

  // Prerendered markup has no clock yet, so no pill and no Today tag. The browser clock is cleared
  // by hand, which avoids depending on when afterNextRender fires
  it('shows neither status nor Today while the browser clock is unknown', async () => {
    setNow('2026-11-22T21:00:00Z');
    const { fixture, el } = await render();
    expect(el.querySelector('[data-testid="open-status"]')).toBeTruthy();

    // Back to the prerendered state
    fixture.componentInstance['now'].set(null);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="open-status"]')).toBeNull();
    expect(el.textContent).not.toContain('Today');
  });

  // Every hours row has the same box, so marking today never shifts the layout
  it('gives today the same row box as the other rows', async () => {
    setNow('2026-11-22T21:00:00Z');
    const { el } = await render();
    const rows = Array.from(el.querySelectorAll('[data-testid="hours-list"] > div'));
    for (const row of rows) {
      for (const cls of ['-mx-3', 'my-1.5', 'px-4', 'py-[18px]', 'border-b']) {
        expect(row.classList.contains(cls)).toBe(true);
      }
    }
  });

  // Sits in the evening part of the page, with Ahjoomah peeking over the hours
  it('renders in the evening with a peeking Ahjoomah', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-visit"]')?.classList).toContain(
      'from-sky-twilight',
    );
    expect(el.querySelector('[data-testid="ahjoomah-peek"]')).toBeTruthy();
  });
});

describe('chicagoClock', () => {
  // Summer: 02:30 UTC Sunday is still Saturday evening in Chicago (UTC-5)
  it('converts to Chicago daylight time', () => {
    expect(chicagoClock(new Date('2026-07-12T02:30:00Z'))).toEqual({
      day: 6,
      minutes: 21 * 60 + 30,
    });
  });

  // Winter: 04:00 UTC Monday is Sunday 10 PM in Chicago (UTC-6)
  it('converts to Chicago standard time', () => {
    expect(chicagoClock(new Date('2026-01-05T04:00:00Z'))).toEqual({ day: 0, minutes: 22 * 60 });
  });

  // Midnight in Chicago reads as 0 minutes, never 24 hours
  it('reads midnight as minute zero', () => {
    expect(chicagoClock(new Date('2026-01-05T06:00:00Z'))).toEqual({ day: 1, minutes: 0 });
  });
});

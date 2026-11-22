import { TestBed } from '@angular/core/testing';
import { DetailsStep } from './details-step';
import { Slot } from './reservation.models';

// The 01:30 hour happens twice when clocks fall back; only the offset tells them apart
const REPEATED_HOUR: Slot[] = [
  {
    time: '01:30',
    startDate: '2026-11-01T01:30:00-05:00',
    available: true,
    manualApproval: false,
  },
  {
    time: '01:30',
    startDate: '2026-11-01T01:30:00-06:00',
    available: true,
    manualApproval: false,
  },
];

describe('DetailsStep slot list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Two slots that share a time must both render, with no duplicate-key warning from Angular
  it('renders slots with the same time and different startDate without a duplicate key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({ imports: [DetailsStep] }).compileComponents();
    const fixture = TestBed.createComponent(DetailsStep);
    fixture.componentRef.setInput('partySize', 2);
    fixture.componentRef.setInput('date', '2026-11-01');
    fixture.componentRef.setInput('minDate', '2026-01-01');
    fixture.componentRef.setInput('slots', REPEATED_HOUR);
    fixture.componentRef.setInput('slotsState', 'ready');
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="slot"]');
    expect(buttons.length).toBe(2);
    const logged = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]));
    expect(logged.filter((message) => message.includes('NG0955'))).toEqual([]);
  });
});

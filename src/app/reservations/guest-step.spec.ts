import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuestStep } from './guest-step';

const MINUTE = 60_000;
const byId = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('GuestStep countdown', () => {
  let fixture: ComponentFixture<GuestStep>;
  let el: HTMLElement;
  let expired: number;

  // Builds the step with a hold ending `msFromNow` after the (fake) browser clock
  async function open(msFromNow: number) {
    // Fake only the clocks and the interval, so Angular's own scheduling is untouched
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-01-15T18:00:00Z'));
    await TestBed.configureTestingModule({ imports: [GuestStep] }).compileComponents();
    fixture = TestBed.createComponent(GuestStep);
    el = fixture.nativeElement as HTMLElement;
    expired = 0;
    fixture.componentInstance.expired.subscribe(() => expired++);
    fixture.componentRef.setInput('date', '2026-01-20');
    fixture.componentRef.setInput('time', '17:00');
    fixture.componentRef.setInput('partySize', 2);
    fixture.componentRef.setInput('expiresAt', new Date(Date.now() + msFromNow).toISOString());
    fixture.detectChanges();
  }

  // Moves the clocks on and lets the page react
  function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  afterEach(() => {
    // Stop the interval while it is still faked, then put the real clocks back
    fixture?.destroy();
    vi.useRealTimers();
  });

  // The usual case: the browser and the server agree, so the real remaining time shows
  it('counts down from the server time when the clocks agree', async () => {
    await open(5 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('5:00');
    expect(byId(el, 'countdown-status')?.textContent).toContain('5 minutes left');
    advance(1000);
    expect(byId(el, 'countdown')?.textContent).toBe('4:59');
    expect(expired).toBe(0);
    advance(5 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('0:00');
    expect(byId(el, 'countdown-status')?.textContent).toContain('expired');
    expect(expired).toBe(1);
  });

  // Browser clock ahead of the server: expiresAt already looks past, so use the nominal hold
  it('uses the nominal hold when expiresAt is far in the past', async () => {
    await open(-60 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('10:00');
    expect(expired).toBe(0);
    advance(9 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('1:00');
    expect(expired).toBe(0);
    advance(MINUTE);
    expect(expired).toBe(1);
  });

  // Browser clock behind the server: expiresAt looks hours away, so use the nominal hold
  it('uses the nominal hold when expiresAt is far in the future', async () => {
    await open(3 * 60 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('10:00');
    advance(10 * MINUTE);
    expect(expired).toBe(1);
  });

  // A gap just inside the allowed window is believed rather than replaced
  it('trusts a gap within the hold length plus two minutes', async () => {
    await open(11 * MINUTE);
    expect(byId(el, 'countdown')?.textContent).toBe('11:00');
  });

  // The countdown follows the monotonic clock, so a wall-clock jump does not move it
  it('ignores a change of the wall clock once counting', async () => {
    await open(5 * MINUTE);
    // Browser clock set a day ahead mid-hold; only Date moves, performance keeps its pace
    vi.setSystemTime(new Date('2026-01-16T18:00:00Z'));
    advance(1000);
    expect(byId(el, 'countdown')?.textContent).toBe('4:59');
    expect(expired).toBe(0);
  });
});

describe('GuestStep with an unusable expiresAt', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // No end time means no countdown, rather than a wrong one
  it('shows no countdown when expiresAt cannot be read', async () => {
    await TestBed.configureTestingModule({ imports: [GuestStep] }).compileComponents();
    const fixture = TestBed.createComponent(GuestStep);
    fixture.componentRef.setInput('date', '2026-01-20');
    fixture.componentRef.setInput('time', '17:00');
    fixture.componentRef.setInput('partySize', 2);
    fixture.componentRef.setInput('expiresAt', 'not a date');
    fixture.detectChanges();
    expect(byId(fixture.nativeElement, 'countdown')).toBeNull();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { todayIso } from './reservation.format';
import { ReservationsPage } from './reservations';

const SLOTS_URL = '/api/v1/reservations/slots';
const HOLDS_URL = '/api/v1/reservations/holds';
const FUTURE_DATE = '2099-01-01';

// Three times: one free, one taken, one free but approved by hand
function slotsBody(date: string, partySize = 2) {
  return {
    date,
    partySize,
    slots: [
      {
        time: '17:00',
        startDate: `${date}T17:00:00-06:00`,
        available: true,
        manualApproval: false,
      },
      {
        time: '17:30',
        startDate: `${date}T17:30:00-06:00`,
        available: false,
        manualApproval: false,
      },
      { time: '18:00', startDate: `${date}T18:00:00-06:00`, available: true, manualApproval: true },
    ],
  };
}

// A winter date, so -06:00 is Chicago's real offset in every season the suite runs
function holdBody(msFromNow = 10 * 60 * 1000) {
  return {
    id: 'r1',
    revision: 'rev-1',
    expiresAt: new Date(Date.now() + msFromNow).toISOString(),
    startDate: `${FUTURE_DATE}T17:00:00-06:00`,
    partySize: 2,
  };
}

// Builds the page; `url` is visited first so a test can open it on ?reservationId=
async function setup(url?: string) {
  await TestBed.configureTestingModule({
    imports: [ReservationsPage],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();
  const router = TestBed.inject(Router);
  if (url) {
    await router.navigateByUrl(url);
  }
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ReservationsPage);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, http, router };
}

// Opens the page on today's slots and answers the first request
async function setupWithSlots() {
  const ctx = await setup();
  ctx.http
    .expectOne((r) => r.url === SLOTS_URL && r.params.get('date') === todayIso())
    .flush(slotsBody(todayIso()));
  ctx.fixture.detectChanges();
  return ctx;
}

const byId = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

// Types into an input the way a guest would
function type(el: HTMLInputElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

// Picks the free 17:00 slot and presses Reserve Now
function reserve(fixture: ComponentFixture<ReservationsPage>, el: HTMLElement) {
  el.querySelectorAll<HTMLButtonElement>('[data-testid="slot"]')[0].click();
  fixture.detectChanges();
  byId(el, 'reserve-now')!.click();
}

// Fills the guest form with valid details
function fillGuest(el: HTMLElement) {
  type(el.querySelector<HTMLInputElement>('#guest-first-name')!, 'Min');
  type(el.querySelector<HTMLInputElement>('#guest-phone')!, '312 555 0142');
  type(el.querySelector<HTMLInputElement>('#guest-email')!, 'min@example.com');
}

describe('ReservationsPage', () => {
  afterEach(() => {
    // Specs that fake the clock must not leak it into the next one
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  // Opening the page asks for today's slots for two guests
  it('loads slots for today and two guests on open', async () => {
    const { el, http, fixture } = await setup();
    const req = http.expectOne((r) => r.url === SLOTS_URL);
    expect(req.request.params.get('date')).toBe(todayIso());
    expect(req.request.params.get('partySize')).toBe('2');
    fixture.detectChanges();
    expect(el.textContent).toContain('Loading available times');
    req.flush(slotsBody(todayIso()));
    fixture.detectChanges();
    const slots = Array.from(el.querySelectorAll<HTMLButtonElement>('[data-testid="slot"]'));
    const labels = slots.map((s) => s.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(labels[0]).toBe('5:00 PM');
    expect(labels[1]).toContain('5:30 PM');
    expect(labels[1]).toContain('unavailable');
    expect(labels[2]).toContain('6:00 PM');
    expect(labels[2]).toContain('By request');
  });

  // Taken times cannot be picked
  it('disables unavailable slots with a strike-through', async () => {
    const { el } = await setupWithSlots();
    const slots = el.querySelectorAll<HTMLButtonElement>('[data-testid="slot"]');
    expect(slots[1].disabled).toBe(true);
    expect(slots[1].className).toContain('line-through');
    expect(slots[0].disabled).toBe(false);
  });

  // Reserve Now waits for a slot, and the chosen slot is highlighted
  it('enables Reserve Now once a slot is selected and highlights it', async () => {
    const { el, fixture } = await setupWithSlots();
    const button = byId(el, 'reserve-now') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const slot = el.querySelectorAll<HTMLButtonElement>('[data-testid="slot"]')[0];
    slot.click();
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(slot.getAttribute('aria-pressed')).toBe('true');
    expect(slot.className).toContain('bg-brand-amber');
  });

  // A new party size means new availability, and the old pick no longer applies
  it('reloads slots and clears the selection when the party size changes', async () => {
    const { el, http, fixture } = await setupWithSlots();
    el.querySelectorAll<HTMLButtonElement>('[data-testid="slot"]')[0].click();
    fixture.detectChanges();
    const select = byId(el, 'party-size') as HTMLSelectElement;
    expect(select.options.length).toBe(10);
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    const req = http.expectOne((r) => r.url === SLOTS_URL);
    expect(req.request.params.get('partySize')).toBe('4');
    req.flush(slotsBody(todayIso(), 4));
    fixture.detectChanges();
    expect((byId(el, 'reserve-now') as HTMLButtonElement).disabled).toBe(true);
  });

  // The date input stops at today and a new date reloads the grid
  it('limits the date to today and reloads slots for a new date', async () => {
    const { el, http, fixture } = await setupWithSlots();
    const input = byId(el, 'visit-date') as HTMLInputElement;
    expect(input.min).toBe(todayIso());
    input.value = FUTURE_DATE;
    input.dispatchEvent(new Event('change'));
    http
      .expectOne((r) => r.url === SLOTS_URL && r.params.get('date') === FUTURE_DATE)
      .flush(slotsBody(FUTURE_DATE));
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="slot"]').length).toBe(3);
  });

  // A failed slot load shows the API's own message
  it('shows the problem detail when slots fail to load', async () => {
    const { el, http, fixture } = await setup();
    http
      .expectOne((r) => r.url === SLOTS_URL)
      .flush({ detail: 'Bookings are closed today.' }, { status: 503, statusText: 'x' });
    fixture.detectChanges();
    expect(byId(el, 'slots-error')?.textContent).toContain('Bookings are closed today.');
  });

  // Without a detail the guest still gets a readable message
  it('falls back to a generic message when the error has no detail', async () => {
    const { el, http, fixture } = await setup();
    http.expectOne((r) => r.url === SLOTS_URL).flush('boom', { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(byId(el, 'slots-error')?.textContent).toContain('Something went wrong');
  });

  // The hold and confirm calls, then the thank-you step with the id in the address
  it('holds the slot, confirms the guest and shows the confirmation', async () => {
    const { el, http, fixture, router } = await setupWithSlots();
    reserve(fixture, el);
    const hold = http.expectOne(HOLDS_URL);
    expect(hold.request.body).toEqual({ date: todayIso(), time: '17:00', partySize: 2 });
    hold.flush(holdBody());
    fixture.detectChanges();

    // Guest step with the summary and countdown
    expect(el.querySelector('#guest-heading')?.textContent).toContain('Complete your reservation');
    expect(byId(el, 'summary-time')?.textContent).toContain('5:00 PM');
    expect(byId(el, 'summary-party')?.textContent).toContain('2 guests');
    expect(byId(el, 'countdown')?.textContent).toMatch(/^\d+:\d{2}$/);

    fillGuest(el);
    submit(el.querySelector('form')!);
    const confirm = http.expectOne('/api/v1/reservations/r1/confirm');
    expect(confirm.request.body).toEqual({
      firstName: 'Min',
      phone: '312 555 0142',
      email: 'min@example.com',
    });
    confirm.flush({
      id: 'r1',
      status: 'REQUESTED',
      startDate: `${FUTURE_DATE}T17:00:00-06:00`,
      partySize: 2,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(byId(el, 'thank-you-heading')?.textContent).toContain('Thank you for booking');
    expect(byId(el, 'status-note')?.textContent).toContain('confirm your reservation by email');
    expect(byId(el, 'confirm-time')?.textContent).toContain('5:00 PM');
    expect(router.url).toContain('reservationId=r1');
  });

  // A failed hold keeps the guest on step one with the reason
  it('shows the problem detail when the hold fails', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(
      {
        detail: 'Party size is too large.',
        errors: [{ field: 'partySize', message: 'Party size is too large.' }],
      },
      { status: 422, statusText: 'x' },
    );
    fixture.detectChanges();
    expect(byId(el, 'hold-error')?.textContent).toContain('Party size is too large.');
    expect(byId(el, 'details-step')).toBeTruthy();
  });

  // Required fields are checked before anything is sent
  it('validates the guest form inline and sends nothing while invalid', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    submit(el.querySelector('form')!);
    fixture.detectChanges();
    expect(el.querySelector('#guest-first-name-error')?.textContent).toContain('first name');
    expect(el.querySelector('#guest-phone-error')?.textContent).toContain('phone');
    expect(el.querySelector('#guest-email-error')?.textContent).toContain('email');
    expect(el.querySelector('#guest-first-name')?.getAttribute('aria-invalid')).toBe('true');
    http.expectNone('/api/v1/reservations/r1/confirm');
  });

  // The API's per-field messages land beside the matching fields
  it('maps 422 field errors onto the form fields', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    fillGuest(el);
    submit(el.querySelector('form')!);
    http.expectOne('/api/v1/reservations/r1/confirm').flush(
      {
        detail: 'That address bounced.',
        errors: [{ field: 'email', message: 'That address bounced.' }],
      },
      { status: 422, statusText: 'x' },
    );
    fixture.detectChanges();
    expect(el.querySelector('#guest-email-error')?.textContent).toContain('That address bounced.');
    expect(byId(el, 'confirm-error')?.textContent).toContain('That address bounced.');
  });

  // Without a detail, the first errors[] message becomes the summary
  it('uses the first field message as the summary when the 422 has no detail', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    fillGuest(el);
    submit(el.querySelector('form')!);
    http
      .expectOne('/api/v1/reservations/r1/confirm')
      .flush(
        { errors: [{ field: 'phone', message: 'Enter a valid phone number.' }] },
        { status: 422, statusText: 'x' },
      );
    fixture.detectChanges();
    expect(el.querySelector('#guest-phone-error')?.textContent).toContain('valid phone number');
    expect(byId(el, 'confirm-error')?.textContent).toContain('Enter a valid phone number.');
  });

  // The countdown reaching zero sends the guest back with a clear message
  it('returns to step one with a notice when the hold expires', async () => {
    const { el, http, fixture } = await setupWithSlots();
    // Fake only the clock and the countdown's interval, so Angular's own scheduling is untouched
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody(5000));
    fixture.detectChanges();
    // Still on the guest step while time remains
    expect(byId(el, 'guest-step')).toBeTruthy();
    expect(byId(el, 'countdown')?.textContent).toBe('0:05');

    // Run the clock past the expiry
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    fixture.detectChanges();
    // Back on step one, with fresh slots requested
    http.expectOne((r) => r.url === SLOTS_URL).flush(slotsBody(todayIso()));
    fixture.detectChanges();
    expect(byId(el, 'details-step')).toBeTruthy();
    expect(byId(el, 'details-notice')?.textContent).toContain('hold expired');
  });

  // A confirm refused because the hold is gone is treated the same way
  it('treats a 409 on confirm as an expired hold', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    fillGuest(el);
    submit(el.querySelector('form')!);
    http
      .expectOne('/api/v1/reservations/r1/confirm')
      .flush({ detail: 'This hold has expired.' }, { status: 409, statusText: 'x' });
    http.expectOne((r) => r.url === SLOTS_URL).flush(slotsBody(todayIso()));
    fixture.detectChanges();
    expect(byId(el, 'details-notice')?.textContent).toContain('This hold has expired.');
  });

  // A confirm that answers 404 means the hold no longer exists, handled the same way
  it('treats a 404 on confirm as an expired hold', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    fillGuest(el);
    submit(el.querySelector('form')!);
    http
      .expectOne('/api/v1/reservations/r1/confirm')
      .flush('missing', { status: 404, statusText: 'x' });
    // Fresh times are requested for the step-one view
    http.expectOne((r) => r.url === SLOTS_URL).flush(slotsBody(todayIso()));
    fixture.detectChanges();
    expect(byId(el, 'details-step')).toBeTruthy();
    expect(byId(el, 'details-notice')?.textContent).toContain('hold expired');
  });

  // Change selection goes back to step one
  it('returns to step one from Change selection', async () => {
    const { el, http, fixture } = await setupWithSlots();
    reserve(fixture, el);
    http.expectOne(HOLDS_URL).flush(holdBody());
    fixture.detectChanges();
    byId(el, 'change-selection')!.click();
    http.expectOne((r) => r.url === SLOTS_URL).flush(slotsBody(todayIso()));
    fixture.detectChanges();
    expect(byId(el, 'details-step')).toBeTruthy();
  });
});

describe('ReservationsPage on a reservation link', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  const booked = {
    id: 'r1',
    status: 'RESERVED',
    startDate: `${FUTURE_DATE}T18:30:00-06:00`,
    partySize: 4,
  };

  // A reload on ?reservationId= fetches the booking instead of starting over
  it('loads the reservation by id and shows the confirmation', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectNone((r) => r.url === SLOTS_URL);
    fixture.detectChanges();
    expect(el.textContent).toContain('Loading your reservation');
    http.expectOne('/api/v1/reservations/r1').flush(booked);
    fixture.detectChanges();
    expect(byId(el, 'thank-you-heading')).toBeTruthy();
    expect(byId(el, 'confirm-time')?.textContent).toContain('6:30 PM');
    expect(byId(el, 'confirm-party')?.textContent).toContain('4 guests');
    expect(byId(el, 'status-note')?.textContent).toContain('confirmed');
  });

  // A lookup that fails says why
  it('shows the problem detail when the reservation cannot be loaded', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http
      .expectOne('/api/v1/reservations/r1')
      .flush({ detail: 'Reservation not found.' }, { status: 404, statusText: 'x' });
    fixture.detectChanges();
    expect(byId(el, 'reservation-error')?.textContent).toContain('Reservation not found.');
  });

  // The dialog specs below only cover the fallback used when jsdom has no showModal(): the open
  // attribute is toggled by hand, so native focus trapping, Escape and the backdrop are not tested

  // Cancel asks for the phone, then reports the cancellation
  it('cancels after the phone check and offers a new reservation', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush(booked);
    fixture.detectChanges();
    byId(el, 'cancel-reservation')!.click();
    fixture.detectChanges();
    const dialog = byId(el, 'cancel-dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('Keep');
    expect(dialog.textContent).toContain('Yes, Cancel');

    // Blank phone is refused without a request
    submit(dialog.querySelector('form')!);
    fixture.detectChanges();
    expect(dialog.textContent).toContain('Enter the phone number');
    http.expectNone('/api/v1/reservations/r1/cancel');

    type(byId(el, 'cancel-phone') as HTMLInputElement, '312 555 0142');
    submit(dialog.querySelector('form')!);
    const req = http.expectOne('/api/v1/reservations/r1/cancel');
    expect(req.request.body).toEqual({ phone: '312 555 0142' });
    req.flush({ id: 'r1', status: 'CANCELED' });
    fixture.detectChanges();
    expect(byId(el, 'canceled-heading')?.textContent).toContain(
      'Your reservation has been canceled',
    );
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(byId(el, 'new-reservation')?.textContent).toContain('Make a New Reservation');
  });

  // A wrong phone keeps the dialog open with the API's message
  it('keeps the dialog open and shows the detail when the phone does not match', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush(booked);
    fixture.detectChanges();
    byId(el, 'cancel-reservation')!.click();
    fixture.detectChanges();
    type(byId(el, 'cancel-phone') as HTMLInputElement, '000');
    submit((byId(el, 'cancel-dialog') as HTMLElement).querySelector('form')!);
    http
      .expectOne('/api/v1/reservations/r1/cancel')
      .flush({ detail: 'That phone number does not match.' }, { status: 403, statusText: 'x' });
    fixture.detectChanges();
    expect(byId(el, 'cancel-error')?.textContent).toContain('does not match');
    expect((byId(el, 'cancel-dialog') as HTMLElement).hasAttribute('open')).toBe(true);
  });

  // A 422 on the phone shows beside the field, not in the general alert
  it('shows a 422 phone message beside the phone field', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush(booked);
    fixture.detectChanges();
    byId(el, 'cancel-reservation')!.click();
    fixture.detectChanges();
    const phone = byId(el, 'cancel-phone') as HTMLInputElement;
    type(phone, '12');
    submit((byId(el, 'cancel-dialog') as HTMLElement).querySelector('form')!);
    http.expectOne('/api/v1/reservations/r1/cancel').flush(
      {
        detail: 'Enter a valid phone number.',
        errors: [{ field: 'phone', message: 'Enter a valid phone number.' }],
      },
      { status: 422, statusText: 'x' },
    );
    fixture.detectChanges();
    expect(el.querySelector('#cancel-phone-error')?.textContent).toContain('valid phone number');
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(byId(el, 'cancel-error')?.textContent?.trim()).toBe('');

    // Editing the field clears the message
    type(phone, '312 555 0142');
    fixture.detectChanges();
    expect(el.querySelector('#cancel-phone-error')?.textContent?.trim()).toBe('');
  });

  // Keep closes the dialog and leaves the booking alone
  it('closes the dialog with Keep and sends nothing', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush(booked);
    fixture.detectChanges();
    byId(el, 'cancel-reservation')!.click();
    fixture.detectChanges();
    byId(el, 'cancel-keep')!.click();
    fixture.detectChanges();
    expect((byId(el, 'cancel-dialog') as HTMLElement).hasAttribute('open')).toBe(false);
    expect(byId(el, 'thank-you-heading')).toBeTruthy();
  });

  // Starting over drops the id and goes back to the slot picker
  it('starts a new reservation from the canceled view', async () => {
    const { el, http, fixture, router } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush({ ...booked, status: 'CANCELED' });
    fixture.detectChanges();
    byId(el, 'new-reservation')!.click();
    http.expectOne((r) => r.url === SLOTS_URL).flush(slotsBody(todayIso()));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(byId(el, 'details-step')).toBeTruthy();
    expect(router.url).not.toContain('reservationId');
  });

  // REQUESTED is a booking too: thank-you with the by-email note and a cancel button
  it('shows the thank-you with the email note for a REQUESTED reservation', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush({ ...booked, status: 'REQUESTED' });
    fixture.detectChanges();
    expect(byId(el, 'thank-you-heading')).toBeTruthy();
    expect(byId(el, 'status-note')?.textContent).toContain('confirm your reservation by email');
    expect(byId(el, 'cancel-reservation')).toBeTruthy();
  });

  // Any other status is not a live booking: no thank-you and no cancel
  it.each(['HELD', 'FINISHED'])('shows a neutral message for a %s reservation', async (status) => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush({ ...booked, status });
    fixture.detectChanges();
    expect(byId(el, 'inactive-heading')?.textContent).toContain(
      'This reservation is no longer active',
    );
    expect(byId(el, 'thank-you-heading')).toBeNull();
    expect(byId(el, 'canceled-heading')).toBeNull();
    expect(byId(el, 'cancel-reservation')).toBeNull();
    expect(byId(el, 'new-reservation')?.textContent).toContain('Make a New Reservation');
  });

  // A reservation without a start time leaves the date and time out instead of showing 1970
  it('does not render a date or time when startDate is missing', async () => {
    const { el, http, fixture } = await setup('/?reservationId=r1');
    http.expectOne('/api/v1/reservations/r1').flush({ ...booked, startDate: null });
    fixture.detectChanges();
    expect(byId(el, 'thank-you-heading')).toBeTruthy();
    expect(byId(el, 'confirm-date')).toBeNull();
    expect(byId(el, 'confirm-time')).toBeNull();
    expect(el.textContent).not.toContain('1970');
    expect(byId(el, 'confirm-party')?.textContent).toContain('4 guests');
  });
});

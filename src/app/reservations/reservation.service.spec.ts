import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../core/api/api-config';
import { fieldErrors, GENERIC_ERROR, problemMessage } from './reservation.errors';
import { ReservationService } from './reservation.service';

function setup(base?: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...(base ? [{ provide: API_BASE_URL, useValue: base }] : []),
    ],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    service: TestBed.inject(ReservationService),
  };
}

describe('ReservationService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  // Slots are a GET with the date and party size as query parameters
  it('requests slots with date and partySize', () => {
    const { http, service } = setup();
    const body = { date: '2026-12-05', partySize: 4, slots: [] };
    let result: unknown;
    service.slots('2026-12-05', 4).subscribe((r) => (result = r));
    const req = http.expectOne((r) => r.url === '/api/v1/reservations/slots');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('date')).toBe('2026-12-05');
    expect(req.request.params.get('partySize')).toBe('4');
    req.flush(body);
    expect(result).toEqual(body);
  });

  // Holding a slot posts the guest's choice as JSON
  it('posts a hold request', () => {
    const { http, service } = setup();
    service.hold({ date: '2026-12-05', time: '18:30', partySize: 2 }).subscribe();
    const req = http.expectOne('/api/v1/reservations/holds');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ date: '2026-12-05', time: '18:30', partySize: 2 });
    req.flush({});
  });

  // Confirm goes to the hold's id with the guest details
  it('posts guest details to the confirm endpoint', () => {
    const { http, service } = setup();
    const guest = { firstName: 'Min', phone: '3125550142', email: 'min@example.com' };
    service.confirm('abc', guest).subscribe();
    const req = http.expectOne('/api/v1/reservations/abc/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(guest);
    req.flush({});
  });

  // A reload fetches the booking by id
  it('gets a reservation by id', () => {
    const { http, service } = setup();
    service.get('abc').subscribe();
    const req = http.expectOne('/api/v1/reservations/abc');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  // Cancel sends only the phone number
  it('posts the phone to the cancel endpoint', () => {
    const { http, service } = setup();
    service.cancel('abc', '3125550142').subscribe();
    const req = http.expectOne('/api/v1/reservations/abc/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phone: '3125550142' });
    req.flush({});
  });

  // Ids are encoded so they cannot change the path
  it('encodes the id in the path', () => {
    const { http, service } = setup();
    service.get('a/b').subscribe();
    http.expectOne('/api/v1/reservations/a%2Fb').flush({});
  });

  // The base URL can be swapped, as the SSR server does
  it('honours a custom API_BASE_URL', () => {
    const { http, service } = setup('http://api:8000/api/v1');
    service.get('abc').subscribe();
    http.expectOne('http://api:8000/api/v1/reservations/abc').flush({});
  });

  // Errors reach the caller untouched
  it('passes an HTTP error through to the subscriber', () => {
    const { http, service } = setup();
    let error: unknown;
    service.get('abc').subscribe({ error: (e) => (error = e) });
    http
      .expectOne('/api/v1/reservations/abc')
      .flush({ detail: 'Nope' }, { status: 404, statusText: 'Not Found' });
    expect(error).toBeInstanceOf(HttpErrorResponse);
  });
});

describe('problemMessage', () => {
  const failure = (body: unknown, status = 422) =>
    new HttpErrorResponse({ status, error: body, statusText: 'x' });

  // The API's own words win
  it('uses the problem+json detail', () => {
    expect(problemMessage(failure({ detail: ' That time is gone. ' }))).toBe('That time is gone.');
  });

  // The server also lists the field messages; the first one stands in when detail is missing
  it('uses the first errors[] message when there is no detail', () => {
    const body = {
      errors: [
        { field: 'email', message: ' Enter a valid email. ' },
        { field: 'phone', message: 'Too short.' },
      ],
    };
    expect(problemMessage(failure(body))).toBe('Enter a valid email.');
  });

  // Detail still wins over the list
  it('prefers detail over errors[]', () => {
    const body = {
      detail: 'Enter a valid email.',
      errors: [{ field: 'phone', message: 'Other.' }],
    };
    expect(problemMessage(failure(body))).toBe('Enter a valid email.');
  });

  // No detail means the generic text, or the caller's own fallback
  it('falls back when there is no detail', () => {
    expect(problemMessage(failure({ title: 'x' }))).toBe(GENERIC_ERROR);
    expect(problemMessage(failure('oops', 500), 'Custom')).toBe('Custom');
    expect(problemMessage(new Error('boom'))).toBe(GENERIC_ERROR);
  });

  // A request that got no answer says so
  it('explains a network failure', () => {
    expect(problemMessage(failure(null, 0))).toContain('could not reach the server');
  });
});

describe('fieldErrors', () => {
  // Each rejected field maps to its message
  it('maps errors[].field to its message', () => {
    const err = new HttpErrorResponse({
      status: 422,
      statusText: 'x',
      error: {
        detail: 'Enter a valid email.',
        errors: [
          { field: 'email', message: 'Enter a valid email.' },
          { field: 'phone', message: 'Too short.' },
          { message: 'no field' },
        ],
      },
    });
    expect(fieldErrors(err)).toEqual({ email: 'Enter a valid email.', phone: 'Too short.' });
  });

  // Bodies without a list give nothing
  it('returns nothing when there is no errors list', () => {
    expect(fieldErrors(new HttpErrorResponse({ status: 500, error: {} }))).toEqual({});
    expect(fieldErrors('x')).toEqual({});
  });
});

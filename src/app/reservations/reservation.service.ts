import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api/api-config';
import {
  CancelResult,
  GuestDetails,
  Hold,
  HoldRequest,
  Reservation,
  SlotsResponse,
} from './reservation.models';

// Talks to the reservations API; every call is one request and errors are left to the caller
@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // Time slots for a date (YYYY-MM-DD) and party size
  slots(date: string, partySize: number): Observable<SlotsResponse> {
    const params = new HttpParams().set('date', date).set('partySize', partySize);
    return this.http.get<SlotsResponse>(`${this.base}/reservations/slots`, { params });
  }

  // Holds a slot for a few minutes while the guest enters their details
  hold(request: HoldRequest): Observable<Hold> {
    return this.http.post<Hold>(`${this.base}/reservations/holds`, request);
  }

  // Turns a hold into a reservation
  confirm(id: string, guest: GuestDetails): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.url(id)}/confirm`, guest);
  }

  get(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(this.url(id));
  }

  // The phone number must match the one on the reservation
  cancel(id: string, phone: string): Observable<CancelResult> {
    return this.http.post<CancelResult>(`${this.url(id)}/cancel`, { phone });
  }

  private url(id: string): string {
    return `${this.base}/reservations/${encodeURIComponent(id)}`;
  }
}

// One bookable time on the chosen date, as the API lists it
export interface Slot {
  // Local restaurant time, 24-hour "HH:MM"
  time: string;
  startDate: string;
  available: boolean;
  // True when the restaurant approves the booking by hand (the booking is then REQUESTED)
  manualApproval: boolean;
}

export interface SlotsResponse {
  date: string;
  partySize: number;
  slots: Slot[];
}

// What the guest picked on the first step
export interface HoldRequest {
  date: string;
  time: string;
  partySize: number;
}

// A table held for a short time while the guest fills in their details
export interface Hold {
  id: string;
  // Opaque version token, a string from the API
  revision: string;
  // ISO timestamp when the hold lapses
  expiresAt: string;
  startDate: string;
  partySize: number;
}

export interface GuestDetails {
  firstName: string;
  lastName?: string;
  phone: string;
  email: string;
}

// RESERVED is booked; REQUESTED waits for the restaurant to confirm by email
export type ReservationStatus = 'RESERVED' | 'REQUESTED' | 'CANCELED' | (string & {});

export interface Reservation {
  id: string;
  status: ReservationStatus;
  // Can be missing on a reservation that never reached a time
  startDate?: string | null;
  partySize: number;
}

export interface CancelResult {
  id: string;
  status: ReservationStatus;
}

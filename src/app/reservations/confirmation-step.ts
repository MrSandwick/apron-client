import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatStart, guestsLabel, isCanceled } from './reservation.format';
import { Reservation } from './reservation.models';

// Where the reservation lookup is in its load
export type ReservationState = 'loading' | 'ready' | 'error';

// Step three: the booking summary with a cancel action, or the canceled notice.
// Presentational: the page owns the reservation and the cancel dialog.
@Component({
  selector: 'app-confirmation-step',
  templateUrl: './confirmation-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ConfirmationStep {
  readonly reservation = input<Reservation | null>(null);
  readonly state = input<ReservationState>('loading');
  // Why the lookup failed, if it did
  readonly error = input('');

  readonly cancelRequested = output<void>();
  readonly newReservation = output<void>();
  readonly retry = output<void>();

  protected readonly guestsLabel = guestsLabel;
  protected readonly canceled = computed(() => {
    const r = this.reservation();
    return !!r && isCanceled(r.status);
  });
  protected readonly start = computed(() => {
    const r = this.reservation();
    return formatStart(r?.startDate);
  });
  // REQUESTED waits for the restaurant; RESERVED is already booked
  protected readonly requested = computed(() => this.reservation()?.status === 'REQUESTED');
  protected readonly reserved = computed(() => this.reservation()?.status === 'RESERVED');
  // Any other status (HELD, FINISHED, ...) is not a booking the guest can act on
  protected readonly active = computed(() => this.requested() || this.reserved());
}

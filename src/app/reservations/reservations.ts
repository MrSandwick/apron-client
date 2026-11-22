import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CancelDialog } from './cancel-dialog';
import { ConfirmationStep, ReservationState } from './confirmation-step';
import { DetailsStep, SlotsState } from './details-step';
import { GuestStep } from './guest-step';
import { fieldErrors, problemMessage } from './reservation.errors';
import { todayIso } from './reservation.format';
import { GuestDetails, Hold, Reservation, Slot } from './reservation.models';
import { ReservationService } from './reservation.service';

type Step = 'details' | 'guest' | 'confirmation';

// Query parameter that keeps the booking in the address, so a reload shows it again
const ID_PARAM = 'reservationId';
const DEFAULT_PARTY_SIZE = 2;
const HOLD_EXPIRED = 'Your table hold expired. Please choose a time again.';

// The /reservations page: owns the booking state and moves the guest through the three steps
// (details, guest, confirmation). The step components only display and report what the guest did.
@Component({
  selector: 'app-reservations-page',
  imports: [DetailsStep, GuestStep, ConfirmationStep, CancelDialog],
  templateUrl: './reservations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsPage {
  private readonly service = inject(ReservationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly minDate = todayIso();
  protected readonly step = signal<Step>('details');

  // Step one
  protected readonly partySize = signal(DEFAULT_PARTY_SIZE);
  protected readonly date = signal(this.minDate);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly slotsState = signal<SlotsState>('idle');
  protected readonly slotsError = signal('');
  protected readonly selectedTime = signal<string | null>(null);
  protected readonly holding = signal(false);
  protected readonly holdError = signal('');
  protected readonly notice = signal('');

  // Step two: the hold and the day and time it was made for
  protected readonly hold = signal<Hold | null>(null);
  protected readonly heldDate = signal('');
  protected readonly heldTime = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submitFieldErrors = signal<Record<string, string>>({});

  // Step three
  protected readonly reservation = signal<Reservation | null>(null);
  protected readonly reservationState = signal<ReservationState>('loading');
  protected readonly reservationError = signal('');
  protected readonly cancelOpen = signal(false);
  protected readonly canceling = signal(false);
  protected readonly cancelError = signal('');
  protected readonly cancelFieldErrors = signal<Record<string, string>>({});

  private slotsSub?: Subscription;
  private reservationSub?: Subscription;
  // Id from the address that the confirmation step is loading
  private loadingId = '';
  private started = false;
  private lastFocusKey: string | null = null;

  // Changes when the visible step (or its loaded state) changes, to move focus to its heading
  private readonly focusKey = computed(() =>
    this.step() === 'confirmation'
      ? `confirmation:${this.reservationState()}:${this.reservation()?.status ?? ''}`
      : this.step(),
  );

  constructor() {
    // The address drives the page: an id means show that booking, none means start fresh
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.onUrlId(params.get(ID_PARAM));
    });

    // After a step change, move focus to the new heading (not on the first render)
    afterRenderEffect(() => {
      const key = this.focusKey();
      if (this.lastFocusKey !== null && this.lastFocusKey !== key) {
        this.host.nativeElement.querySelector<HTMLElement>('[data-step-heading]')?.focus();
      }
      this.lastFocusKey = key;
    });
  }

  protected setPartySize(size: number): void {
    this.partySize.set(size);
    this.holdError.set('');
    this.loadSlots();
  }

  protected setDate(date: string): void {
    this.date.set(date);
    this.holdError.set('');
    this.loadSlots();
  }

  protected selectSlot(time: string): void {
    this.selectedTime.set(time);
    this.holdError.set('');
  }

  // Fetches the times for the chosen date and party; a newer request replaces an older one
  protected loadSlots(): void {
    this.slotsSub?.unsubscribe();
    this.selectedTime.set(null);
    const date = this.date();
    if (!date || date < this.minDate) {
      this.slots.set([]);
      this.slotsState.set('idle');
      return;
    }
    this.slotsError.set('');
    this.slotsState.set('loading');
    this.slotsSub = this.service.slots(date, this.partySize()).subscribe({
      next: (res) => {
        this.slots.set(res.slots);
        this.slotsState.set('ready');
      },
      error: (err: unknown) => {
        this.slots.set([]);
        this.slotsError.set(problemMessage(err));
        this.slotsState.set('error');
      },
    });
  }

  // Holds the chosen slot, then moves on to the guest details
  protected reserveNow(): void {
    const time = this.selectedTime();
    if (!time || this.holding()) {
      return;
    }
    const date = this.date();
    this.holding.set(true);
    this.holdError.set('');
    this.service.hold({ date, time, partySize: this.partySize() }).subscribe({
      next: (hold) => {
        this.holding.set(false);
        this.hold.set(hold);
        this.heldDate.set(date);
        this.heldTime.set(time);
        this.notice.set('');
        this.submitError.set('');
        this.submitFieldErrors.set({});
        this.step.set('guest');
      },
      error: (err: unknown) => {
        this.holding.set(false);
        this.holdError.set(problemMessage(err));
        // 409: someone else took the slot, so show the times as they are now
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.loadSlots();
        }
      },
    });
  }

  // Sends the guest details; on success the booking goes into the address
  protected submitGuest(details: GuestDetails): void {
    const hold = this.hold();
    if (!hold || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set('');
    this.submitFieldErrors.set({});
    this.service.confirm(hold.id, details).subscribe({
      next: (reservation) => {
        this.submitting.set(false);
        this.hold.set(null);
        this.reservation.set(reservation);
        this.reservationState.set('ready');
        this.step.set('confirmation');
        this.setUrlId(reservation.id);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        // 404, 409 or 410: the hold is gone, so it lapsed while the guest was typing
        if (
          err instanceof HttpErrorResponse &&
          (err.status === 404 || err.status === 409 || err.status === 410)
        ) {
          this.expireHold(problemMessage(err, HOLD_EXPIRED));
          return;
        }
        // 422: show the API's message beside each field it rejected, and the summary below
        this.submitFieldErrors.set(fieldErrors(err));
        this.submitError.set(problemMessage(err));
      },
    });
  }

  // Back to step one, with fresh times
  protected changeSelection(): void {
    this.hold.set(null);
    this.submitError.set('');
    this.notice.set('');
    this.step.set('details');
    this.loadSlots();
  }

  // The hold ran out: say so and return to step one
  protected expireHold(message: string = HOLD_EXPIRED): void {
    this.hold.set(null);
    this.submitError.set('');
    this.notice.set(message);
    this.step.set('details');
    this.loadSlots();
  }

  protected expiredNotice(): void {
    this.expireHold(HOLD_EXPIRED);
  }

  protected openCancel(): void {
    this.cancelError.set('');
    this.cancelFieldErrors.set({});
    this.cancelOpen.set(true);
  }

  protected keepReservation(): void {
    this.cancelOpen.set(false);
  }

  protected cancelReservation(phone: string): void {
    const current = this.reservation();
    if (!current || this.canceling()) {
      return;
    }
    this.canceling.set(true);
    this.cancelError.set('');
    this.cancelFieldErrors.set({});
    this.service.cancel(current.id, phone).subscribe({
      next: (result) => {
        this.canceling.set(false);
        this.cancelOpen.set(false);
        this.reservation.set({ ...current, status: result.status });
      },
      error: (err: unknown) => {
        this.canceling.set(false);
        // A phone message shows beside the field; anything else goes in the dialog's alert
        const fields = fieldErrors(err);
        this.cancelFieldErrors.set(fields);
        this.cancelError.set(fields['phone'] ? '' : problemMessage(err));
      },
    });
  }

  // Clears everything and shows step one again, with the id removed from the address
  protected startOver(): void {
    this.resetBooking();
    this.setUrlId(null);
  }

  protected retryReservation(): void {
    if (this.loadingId) {
      this.loadReservation(this.loadingId);
    }
  }

  private onUrlId(id: string | null): void {
    const first = !this.started;
    this.started = true;
    if (id) {
      // Already showing this booking (just confirmed it): nothing to fetch
      if (this.reservation()?.id !== id) {
        this.loadReservation(id);
      }
    } else if (first) {
      this.loadSlots();
    } else if (this.step() === 'confirmation') {
      // The id left the address (for example the Back button), so go back to step one
      this.resetBooking();
    }
  }

  // Looks the booking up by id, as when the page is reloaded on the confirmation step
  private loadReservation(id: string): void {
    this.reservationSub?.unsubscribe();
    this.loadingId = id;
    this.step.set('confirmation');
    this.reservation.set(null);
    this.reservationError.set('');
    this.reservationState.set('loading');
    this.reservationSub = this.service.get(id).subscribe({
      next: (reservation) => {
        this.reservation.set(reservation);
        this.reservationState.set('ready');
      },
      error: (err: unknown) => {
        this.reservationError.set(problemMessage(err));
        this.reservationState.set('error');
      },
    });
  }

  private resetBooking(): void {
    this.reservationSub?.unsubscribe();
    this.loadingId = '';
    this.reservation.set(null);
    this.reservationState.set('loading');
    this.reservationError.set('');
    this.cancelOpen.set(false);
    this.cancelError.set('');
    this.cancelFieldErrors.set({});
    this.hold.set(null);
    this.notice.set('');
    this.holdError.set('');
    this.submitError.set('');
    this.step.set('details');
    this.loadSlots();
  }

  // Puts the booking id in the address (or takes it out) without losing other parameters
  private setUrlId(id: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [ID_PARAM]: id },
      queryParamsHandling: 'merge',
    });
  }
}

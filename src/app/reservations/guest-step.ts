import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  formatCountdown,
  formatDateLabel,
  formatTimeLabel,
  guestsLabel,
} from './reservation.format';
import { GuestDetails } from './reservation.models';

const HOLD_MINUTES = 10;

type GuestField = 'firstName' | 'lastName' | 'phone' | 'email';

// A value of only spaces does not count as filled in
function notBlank(control: AbstractControl<string>): { required: true } | null {
  return control.value.trim() ? null : { required: true };
}

// At least seven digits, with the usual spaces, dashes, brackets and a leading plus allowed
function phoneShape(control: AbstractControl<string>): { phone: true } | null {
  const value = control.value.trim();
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, '');
  return /^[\d\s()+.-]+$/.test(value) && digits.length >= 7 && digits.length <= 15
    ? null
    : { phone: true };
}

// Step two: the guest's details beside a summary of the held table with a live countdown.
// Presentational: the page sends the details to the API and handles an expired hold.
@Component({
  selector: 'app-guest-step',
  imports: [ReactiveFormsModule],
  templateUrl: './guest-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class GuestStep {
  // The day and time the guest picked, as YYYY-MM-DD and HH:MM
  readonly date = input.required<string>();
  readonly time = input.required<string>();
  readonly partySize = input.required<number>();
  // ISO timestamp when the hold lapses
  readonly expiresAt = input.required<string>();
  // True while the confirm request is in flight
  readonly pending = input(false);
  // Why the confirm failed, if it did
  readonly error = input('');
  // Messages the API gave for individual fields (a 422 response), keyed by field name
  readonly fieldErrors = input<Record<string, string>>({});

  readonly submitted = output<GuestDetails>();
  readonly changeSelection = output<void>();
  // The hold ran out before the guest finished
  readonly expired = output<void>();

  protected readonly guestsLabel = guestsLabel;
  // How long the API holds a table; the hold only carries its end time, so this is fixed
  protected readonly holdMinutes = HOLD_MINUTES;
  protected readonly dateText = computed(() => formatDateLabel(this.date()));
  protected readonly timeText = computed(() => formatTimeLabel(this.time()));

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    lastName: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true, validators: [notBlank, phoneShape] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.email],
    }),
  });
  // Errors stay quiet until a field is touched, or the guest tries to submit
  private readonly attempted = signal(false);
  // The API's field messages, each dropped as soon as the guest edits that field
  private readonly serverErrors = signal<Record<string, string>>({});

  // Current time, ticked once a second in the browser
  private readonly now = signal(Date.now());
  private readonly expiryMs = computed(() => Date.parse(this.expiresAt()));
  // Whole seconds left on the hold, or null when expiresAt is unusable
  protected readonly remaining = computed(() => {
    const end = this.expiryMs();
    return Number.isFinite(end) ? Math.max(0, Math.ceil((end - this.now()) / 1000)) : null;
  });
  protected readonly countdownText = computed(() => {
    const left = this.remaining();
    return left === null ? '' : formatCountdown(left);
  });
  // Spoken only when the wording changes (about once a minute), never every second
  protected readonly announcement = computed(() => {
    const left = this.remaining();
    if (left === null) {
      return '';
    }
    if (left === 0) {
      return 'Your table hold has expired.';
    }
    if (left <= 60) {
      return 'Less than a minute left to hold your table.';
    }
    const minutes = Math.ceil(left / 60);
    return `${minutes} minutes left to hold your table.`;
  });
  protected readonly urgent = computed(() => {
    const left = this.remaining();
    return left !== null && left <= 60;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private expiredSent = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Tick the clock in the browser only; the server never starts a timer
    afterNextRender(() => {
      this.now.set(Date.now());
      const timer = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(timer));
    });

    // Show the API's field messages and put focus on the first field it rejected
    effect(() => {
      const incoming = this.fieldErrors();
      this.serverErrors.set(incoming);
      const first = (['firstName', 'lastName', 'phone', 'email'] as GuestField[]).find(
        (field) => incoming[field],
      );
      if (first) {
        this.host.nativeElement.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      }
    });
    for (const field of ['firstName', 'lastName', 'phone', 'email'] as GuestField[]) {
      this.form.controls[field].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        if (this.serverErrors()[field]) {
          this.serverErrors.update((errors) => {
            const rest = { ...errors };
            delete rest[field];
            return rest;
          });
        }
      });
    }

    // Tell the page once when the hold runs out
    effect(() => {
      if (this.remaining() === 0 && !this.expiredSent) {
        this.expiredSent = true;
        this.expired.emit();
      }
    });
  }

  protected errorText(field: GuestField): string {
    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.attempted())) {
      // The form is fine, but the API may still have rejected this field
      return this.serverErrors()[field] ?? '';
    }
    switch (field) {
      case 'firstName':
        return 'Enter your first name';
      case 'phone':
        return control.errors['required']
          ? 'Enter your phone number'
          : 'Enter a valid phone number, for example 312 555 0142';
      case 'email':
        return control.errors['required']
          ? 'Enter your email address'
          : 'Enter a valid email address';
      default:
        return '';
    }
  }

  protected submit(event: Event): void {
    // Keep the browser from reloading the page
    event.preventDefault();
    if (this.pending()) {
      return;
    }
    this.attempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }
    const value = this.form.getRawValue();
    const lastName = value.lastName.trim();
    this.submitted.emit({
      firstName: value.firstName.trim(),
      ...(lastName ? { lastName } : {}),
      phone: value.phone.trim(),
      email: value.email.trim(),
    });
  }

  private focusFirstInvalid(): void {
    const order: GuestField[] = ['firstName', 'phone', 'email'];
    const bad = order.find((field) => this.form.controls[field].invalid);
    if (bad) {
      this.host.nativeElement.querySelector<HTMLElement>(`[data-field="${bad}"]`)?.focus();
    }
  }
}

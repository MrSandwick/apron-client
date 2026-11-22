import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

// Modal that asks the guest to verify their phone number before a reservation is canceled.
// A native <dialog> gives focus trapping, Escape and a backdrop.
@Component({
  selector: 'app-cancel-dialog',
  templateUrl: './cancel-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelDialog {
  readonly open = input(false);
  // True while the cancel request is in flight
  readonly pending = input(false);
  // Why the cancel failed (for example a phone number that does not match)
  readonly error = input('');
  // Messages the API gave for individual fields (a 422 response); only the phone is shown here
  readonly fieldErrors = input<Record<string, string>>({});

  // The guest chose to keep the reservation (button, Escape or backdrop)
  readonly keep = output<void>();
  readonly confirmCancel = output<string>();

  protected readonly phone = signal('');
  private readonly attempted = signal(false);
  // The API's phone message, dropped as soon as the guest edits the field
  private readonly serverPhoneError = signal('');
  protected readonly phoneError = computed(() =>
    this.attempted() && !this.phone().trim()
      ? 'Enter the phone number on the reservation'
      : this.serverPhoneError(),
  );

  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogEl = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  // What had focus before the dialog opened, so focus can go back there
  private opener: HTMLElement | null = null;

  constructor() {
    // Each opening starts with an empty phone field and no validation message
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.phone.set('');
          this.attempted.set(false);
          this.serverPhoneError.set('');
        });
      }
    });

    // Show the API's phone message beside the field
    effect(() => {
      this.serverPhoneError.set(this.fieldErrors()['phone'] ?? '');
    });

    // Open and close the native dialog after the content has rendered (browser only)
    afterRenderEffect(() => {
      const el = this.dialogEl()?.nativeElement;
      if (!el) {
        return;
      }
      const wanted = this.open();
      if (wanted && !el.open) {
        this.opener = this.doc.activeElement as HTMLElement | null;
        if (typeof el.showModal === 'function') {
          el.showModal();
        } else {
          el.setAttribute('open', '');
        }
        // Start on the phone field rather than the first button
        this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
      } else if (!wanted && el.open) {
        if (typeof el.close === 'function') {
          el.close();
        } else {
          el.removeAttribute('open');
        }
        // Back to the control that opened it, unless that control is gone
        if (this.opener?.isConnected) {
          this.opener.focus();
        }
        this.opener = null;
      }
    });
  }

  protected onInput(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
    this.serverPhoneError.set('');
  }

  protected submit(event: Event): void {
    // Stay on the page when Enter submits the form
    event.preventDefault();
    if (this.pending()) {
      return;
    }
    this.attempted.set(true);
    const phone = this.phone().trim();
    if (!phone) {
      this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    this.confirmCancel.emit(phone);
  }

  // The native close event covers Escape; our own close() call is not reported twice
  protected onNativeClose(): void {
    if (this.open()) {
      this.keep.emit();
    }
  }

  // A click on the backdrop lands on the dialog element itself, not on the card inside
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.keep.emit();
    }
  }
}

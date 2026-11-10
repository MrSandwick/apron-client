import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

// Gives each instance its own ids so labels and status text never collide on one page
let nextId = 0;

// Promo code entry. For now it only acknowledges the input and never touches any totals;
// real promo rules are issue #21.
@Component({
  selector: 'app-promo-field',
  templateUrl: './promo-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PromoField {
  protected readonly inputId = `promo-code-${nextId}`;
  protected readonly statusId = `promo-status-${nextId++}`;

  // What the guest has typed so far
  protected readonly code = signal('');
  // Feedback shown after Apply; empty until the first attempt
  protected readonly message = signal('');

  protected onInput(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  protected apply(event: Event): void {
    // Stay on the page when Enter submits the form
    event.preventDefault();
    this.message.set(
      this.code().trim() ? 'Promo codes are coming soon' : 'Enter a code to apply',
    );
  }
}

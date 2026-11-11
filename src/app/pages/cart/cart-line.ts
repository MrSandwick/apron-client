import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CartLine, MAX_QUANTITY, MIN_QUANTITY } from '../../core/cart/cart.model';
import { formatAmount } from '../../shared/format/price';

// One line in the cart: dish, picks, note, a quantity stepper, the line total and a Remove button.
// The host is the li itself so the page list stays valid HTML.
// It only reports what the guest did; the page owns the cart and applies the change.
@Component({
  selector: 'li[app-cart-line]',
  templateUrl: './cart-line.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Borderless row inside the receipt card, with a divider except on the last one.
    // The grid row lets the leave animation collapse the height (see animate-line-out)
    class:
      'grid grid-rows-[1fr] bg-transparent text-day-ink not-last:border-b not-last:border-day-ink/15',
    'data-testid': 'cart-line',
  },
})
export class CartLineItem {
  readonly line = input.required<CartLine>();
  // Emitted with the new quantity after a step
  readonly quantityChange = output<number>();
  // Emitted when the guest removes the line
  readonly remove = output<void>();

  protected readonly minQuantity = MIN_QUANTITY;
  protected readonly maxQuantity = MAX_QUANTITY;

  // Pick names in the order the groups were saved, as one line of text
  protected readonly picksText = computed(() =>
    this.line()
      .picks.map((pick) => pick.choiceName)
      .join(', '),
  );

  protected readonly unitText = computed(() =>
    formatAmount(this.line().unitMinor, this.line().currency),
  );

  // Saved unit price times quantity, so the total always follows the stepper
  protected readonly totalText = computed(() =>
    formatAmount(this.line().unitMinor * this.line().quantity, this.line().currency),
  );

  protected step(delta: number): void {
    const next = this.line().quantity + delta;
    if (next < MIN_QUANTITY || next > MAX_QUANTITY) {
      return;
    }
    this.quantityChange.emit(next);
  }
}

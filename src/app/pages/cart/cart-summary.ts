import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TweenedAmount } from '../../shared/tweened-amount';

// Order totals card: item count and subtotal, with a slot below for the promo field and checkout
@Component({
  selector: 'app-cart-summary',
  imports: [TweenedAmount],
  templateUrl: './cart-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CartSummary {
  readonly subtotalMinor = input.required<number>();
  readonly currency = input.required<string>();
  readonly count = input.required<number>();
  // Classes for the two values; the page hides them until the intro hands off, then stamps them in
  readonly dynamicClass = input('');
}

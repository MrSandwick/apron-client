import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatAmount } from '../../shared/format/price';

// Order totals card: item count and subtotal, with a slot below for the promo field and checkout
@Component({
  selector: 'app-cart-summary',
  templateUrl: './cart-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CartSummary {
  readonly subtotalMinor = input.required<number>();
  readonly currency = input.required<string>();
  readonly count = input.required<number>();

  protected readonly subtotalText = computed(() =>
    formatAmount(this.subtotalMinor(), this.currency()),
  );
}

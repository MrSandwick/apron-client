import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CartLine } from '../../core/cart/cart.model';
import { CartService } from '../../core/cart/cart.service';
import { formatAmount } from '../../shared/format/price';
import { CartEmpty } from './cart-empty';
import { CartLineItem } from './cart-line';
import { CartSummary } from './cart-summary';
import { DeliveryPanel } from './delivery-panel';
import { FulfillmentMode, FulfillmentToggle } from './fulfillment-toggle';
import { PromoField } from './promo-field';

// Cart page: the guest's lines with steppers, a takeout / delivery choice and the order summary.
// The saved cart is only readable in the browser, so everything that depends on it waits for
// cart.ready() and the server HTML is the same for every guest.
@Component({
  selector: 'app-cart-page',
  imports: [
    CartEmpty,
    CartLineItem,
    CartSummary,
    DeliveryPanel,
    FulfillmentToggle,
    PromoField,
  ],
  templateUrl: './cart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  protected readonly cart = inject(CartService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // Not saved: the page always opens on takeout
  protected readonly mode = signal<FulfillmentMode>('takeout');
  protected readonly isDelivery = computed(() => this.mode() === 'delivery');

  // Text for the polite live region
  protected readonly announcement = signal('');

  // The heading takes focus when the last line is removed
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected readonly subtotalText = computed(() =>
    formatAmount(this.cart.totalMinor(), this.cart.currency()),
  );

  protected readonly countText = computed(() => {
    const count = this.cart.count();
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  });

  protected changeQuantity(line: CartLine, quantity: number): void {
    this.cart.setQuantity(line.key, quantity);
    this.announcement.set(`${line.name}, quantity ${quantity}`);
  }

  protected removeLine(line: CartLine): void {
    const lines = this.cart.lines();
    const index = lines.findIndex((l) => l.key === line.key);
    // Focus goes to the line that takes this one's place, else the one before it
    const neighbour = lines[index + 1] ?? lines[index - 1];
    this.cart.remove(line.key);
    this.announcement.set(`${line.name} removed`);
    // Wait for the list to update before moving focus
    afterNextRender(
      () => {
        const button = neighbour ? this.removeButtonFor(neighbour.key) : null;
        (button ?? this.heading()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  // Keys contain quotes, so match on the attribute value instead of building a selector
  private removeButtonFor(key: string): HTMLElement | null {
    const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-remove]');
    return Array.from(buttons).find((b) => b.getAttribute('data-remove') === key) ?? null;
  }
}

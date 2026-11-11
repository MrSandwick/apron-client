import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CartLine, MAX_QUANTITY, MIN_QUANTITY } from '../../core/cart/cart.model';
import { CartLineItem } from './cart-line';

// A line with two picks and a note, extended per test
const base: CartLine = {
  key: 'k1',
  dishId: 'bulgogi',
  name: 'Bulgogi',
  quantity: 2,
  picks: [
    { groupId: 'size', groupName: 'Size', choiceId: 'l', choiceName: 'Large', extraMinor: 200 },
    { groupId: 'side', groupName: 'Side', choiceId: 'rice', choiceName: 'Rice', extraMinor: 0 },
  ],
  note: 'No sesame',
  unitMinor: 1250,
  totalMinor: 2500,
  currency: 'USD',
};

function render(line: CartLine): ComponentFixture<CartLineItem> {
  const fixture = TestBed.createComponent(CartLineItem);
  fixture.componentRef.setInput('line', line);
  fixture.detectChanges();
  return fixture;
}

function q<T extends HTMLElement>(fixture: ComponentFixture<CartLineItem>, id: string): T {
  return (fixture.nativeElement as HTMLElement).querySelector<T>(`[data-testid="${id}"]`) as T;
}

// Host that uses the component the way the cart page does, as an li inside a ul
@Component({
  imports: [CartLineItem],
  template: '<ul><li app-cart-line [line]="line"></li></ul>',
})
class Host {
  line = base;
}

describe('CartLineItem', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CartLineItem] }).compileComponents();
  });

  // The host element is the list item, with the dish name inside
  it('is a list item with the dish name', () => {
    const host = TestBed.createComponent(Host);
    host.detectChanges();
    const li = (host.nativeElement as HTMLElement).querySelector('ul > li[app-cart-line]');
    expect(li).toBeTruthy();
    expect(li?.querySelector('[data-testid="cart-line-name"]')?.textContent?.trim()).toBe(
      'Bulgogi',
    );
    expect(li?.getAttribute('data-testid')).toBe('cart-line');
  });

  // Picks show as one comma-joined line in saved order
  it('joins pick names in group order', () => {
    expect(q(render(base), 'cart-line-picks').textContent?.trim()).toBe('Large, Rice');
  });

  // No picks and no note means no extra lines
  it('omits picks and note when there are none', () => {
    const fixture = render({ ...base, picks: [], note: '' });
    expect(q(fixture, 'cart-line-picks')).toBeNull();
    expect(q(fixture, 'cart-line-note')).toBeNull();
  });

  // The note is shown when the line has one
  it('shows the note when present', () => {
    expect(q(render(base), 'cart-line-note').textContent).toContain('No sesame');
  });

  // Line total is the saved unit price times the quantity
  it('shows the unit price times quantity as the line total', () => {
    const fixture = render({ ...base, quantity: 3 });
    expect(q(fixture, 'cart-line-unit').textContent).toContain('$12.50');
    expect(q(fixture, 'cart-line-total').textContent?.trim()).toBe('$37.50');
  });

  // The page announces quantity changes, so the line itself must not be a live region
  it('shows the quantity without its own live region', () => {
    const qty = q(render(base), 'cart-line-qty');
    expect(qty.textContent?.trim()).toBe('2');
    expect(qty.hasAttribute('aria-live')).toBe(false);
    expect(qty.getAttribute('role')).toBeNull();
    expect(qty.tagName).not.toBe('OUTPUT');
  });

  // An unpriced dish (0) reads as $0 in the cart, never the menu's $00 placeholder
  it('shows $0 and never the $00 placeholder for a zero price', () => {
    const fixture = render({ ...base, unitMinor: 0, totalMinor: 0 });
    expect(q(fixture, 'cart-line-unit').textContent).toContain('$0');
    expect(q(fixture, 'cart-line-total').textContent?.trim()).toBe('$0');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('$00');
  });

  // The line is a flat, transparent row with a divider unless it is the last row
  it('renders as a flat row with a divider', () => {
    const host = render(base).nativeElement as HTMLElement;
    expect(host.className).toContain('bg-transparent');
    expect(host.className).toContain('not-last:border-b');
    expect(host.className).not.toContain('rounded-2xl');
    expect(host.className).not.toContain('bg-dusk-card');
  });

  // The host is a one-row grid so the leave animation can collapse it, with the content in a clipping wrapper
  it('is a one-row grid host with its content in a clipping wrapper', () => {
    const host = render(base).nativeElement as HTMLElement;
    expect(host.classList.contains('grid')).toBe(true);
    expect(host.classList.contains('grid-rows-[1fr]')).toBe(true);
    expect(host.firstElementChild?.className).toContain('overflow-hidden');
  });

  // Each control is named after the dish
  it('labels the buttons with the dish name', () => {
    const fixture = render(base);
    expect(q(fixture, 'cart-line-decrease').getAttribute('aria-label')).toBe('Decrease Bulgogi');
    expect(q(fixture, 'cart-line-increase').getAttribute('aria-label')).toBe('Increase Bulgogi');
    expect(q(fixture, 'cart-line-remove').getAttribute('aria-label')).toBe('Remove Bulgogi');
  });

  // Decrease is blocked at the minimum quantity only
  it('disables Decrease at the minimum quantity', () => {
    const atMin = render({ ...base, quantity: MIN_QUANTITY });
    expect(q<HTMLButtonElement>(atMin, 'cart-line-decrease').disabled).toBe(true);
    expect(q<HTMLButtonElement>(atMin, 'cart-line-increase').disabled).toBe(false);
  });

  // Increase is blocked at the maximum quantity only
  it('disables Increase at the maximum quantity', () => {
    const atMax = render({ ...base, quantity: MAX_QUANTITY });
    expect(q<HTMLButtonElement>(atMax, 'cart-line-increase').disabled).toBe(true);
    expect(q<HTMLButtonElement>(atMax, 'cart-line-decrease').disabled).toBe(false);
  });

  // Steppers emit the new quantity
  it('emits the new quantity when stepping up and down', () => {
    const fixture = render(base);
    const emitted: number[] = [];
    fixture.componentInstance.quantityChange.subscribe((n) => emitted.push(n));
    q(fixture, 'cart-line-increase').click();
    q(fixture, 'cart-line-decrease').click();
    expect(emitted).toEqual([3, 1]);
  });

  // Remove emits once and carries a data-remove hook for focus handling
  it('emits remove and exposes a data-remove attribute', () => {
    const fixture = render(base);
    let removed = 0;
    fixture.componentInstance.remove.subscribe(() => removed++);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-remove]',
    );
    expect(button).toBeTruthy();
    button?.click();
    expect(removed).toBe(1);
  });

  // All buttons meet the 44px touch target
  it('gives every button a 44px minimum target', () => {
    const buttons = (render(base).nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons.length).toBe(3);
    buttons.forEach((b) => {
      expect(b.className).toContain('min-h-11');
      expect(b.className).toContain('min-w-11');
    });
  });
});

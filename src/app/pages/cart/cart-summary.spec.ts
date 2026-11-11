import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CartSummary } from './cart-summary';

// Host that projects content into the summary slot
@Component({
  imports: [CartSummary],
  template: `
    <app-cart-summary [subtotalMinor]="subtotal" [currency]="currency" [count]="count">
      <button type="button" data-testid="slot-action">Checkout</button>
    </app-cart-summary>
  `,
})
class Host {
  subtotal = 4250;
  currency = 'USD';
  count = 3;
}

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('CartSummary', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  // Items and Subtotal are a description list of term and value pairs
  it('renders Items and Subtotal in a description list', async () => {
    const el = await render();
    const terms = Array.from(el.querySelectorAll('dl dt')).map((t) => t.textContent?.trim());
    expect(terms).toEqual(['Items', 'Subtotal']);
  });

  // The count is shown as given
  it('shows the item count', async () => {
    const el = await render();
    expect(el.querySelector('[data-testid="cart-summary-count"]')?.textContent?.trim()).toBe('3');
  });

  // The subtotal goes through formatAmount
  it('formats the subtotal with the currency', async () => {
    const el = await render();
    expect(el.querySelector('[data-testid="cart-summary-subtotal"]')?.textContent?.trim()).toBe(
      '$42.50',
    );
  });

  // The test-setup matchMedia stub reports no motion preference, so the tween jumps at once
  it('shows a changed subtotal immediately when motion is unavailable', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.componentInstance.subtotal = 1800;
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="cart-summary-subtotal"]')?.textContent?.trim()).toBe(
      '$18',
    );
  });

  // The fees note is always present
  it('shows the taxes and fees note', async () => {
    expect((await render()).textContent).toContain('Taxes and any fees are added at checkout');
  });

  // Projected content lands inside the summary card
  it('projects content into the slot below the totals', async () => {
    const el = await render();
    const action = el.querySelector('[data-testid="slot-action"]');
    expect(action).toBeTruthy();
    expect(el.querySelector('[data-testid="cart-summary"]')?.contains(action)).toBe(true);
  });
});

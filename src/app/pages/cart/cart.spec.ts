import { Provider, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MAX_QUANTITY, NewCartLine } from '../../core/cart/cart.model';
import { CART_STORAGE_KEY, CartService } from '../../core/cart/cart.service';
import { CartPage } from './cart';

// Stored lines have no key or total; the service derives both when it reads them
const stored = (over: Partial<NewCartLine> = {}): NewCartLine => ({
  dishId: 'bulgogi',
  name: 'Bulgogi',
  quantity: 2,
  picks: [],
  note: '',
  unitMinor: 1250,
  currency: 'USD',
  ...over,
});

const LINES = [
  stored(),
  stored({ dishId: 'kimchi', name: 'Kimchi Stew', quantity: 1, unitMinor: 1000 }),
  stored({ dishId: 'japchae', name: 'Japchae', quantity: 1, unitMinor: 900 }),
];
// 2 x 12.50 + 10 + 9
const SUBTOTAL = '$44';

// Mounts the page over an in-memory storage seeded with the given lines
async function mount(lines: NewCartLine[] = LINES, extra: Provider[] = []) {
  const data: Record<string, string> = {};
  if (lines.length) {
    data[CART_STORAGE_KEY] = JSON.stringify({ savedAt: Date.now(), lines });
  }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  });
  await TestBed.configureTestingModule({
    imports: [CartPage],
    providers: [provideRouter([]), ...extra],
  }).compileComponents();
  const fixture = TestBed.createComponent(CartPage);
  const cart = TestBed.inject(CartService);
  return { fixture, cart, el: fixture.nativeElement as HTMLElement };
}

// Runs the first render and the post-render storage read, then renders the result
async function settle(fixture: ComponentFixture<CartPage>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const byId = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const radio = (el: HTMLElement, value: string) =>
  Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
    (r) => r.value === value,
  )!;

const removeButton = (el: HTMLElement, key: string) =>
  Array.from(el.querySelectorAll<HTMLElement>('[data-remove]')).find(
    (b) => b.getAttribute('data-remove') === key,
  )!;

describe('CartPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The cart has not been read yet, so the empty state must not show
  it('shows a loading placeholder, not the empty state, before the cart is ready', async () => {
    // A cart that never becomes ready, as on the server
    const notReady = {
      ready: signal(false),
      lines: signal([]),
      count: signal(0),
      totalMinor: signal(0),
      currency: signal('USD'),
    };
    const { fixture, el } = await mount([], [{ provide: CartService, useValue: notReady }]);
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toContain('Your cart');
    expect(el.textContent).toContain('Loading cart');
    expect(byId(el, 'cart-empty')).toBeNull();
    expect(byId(el, 'cart-count')).toBeNull();
  });

  // An empty saved cart offers a way back to the menu
  it('shows the empty state with a menu link when the cart is empty', async () => {
    const { fixture, el } = await mount([]);
    await settle(fixture);
    expect(byId(el, 'cart-empty')).toBeTruthy();
    expect(el.querySelector('a[href="/menu"]')).toBeTruthy();
    expect(byId(el, 'cart-lines')).toBeNull();
  });

  // Saved lines render as list items with the formatted subtotal and item count
  it('renders the lines, item count and formatted subtotal', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    expect(el.querySelectorAll('ul > li[app-cart-line]').length).toBe(3);
    expect(byId(el, 'cart-count')?.textContent?.trim()).toBe('4 items');
    expect(byId(el, 'cart-summary-subtotal')?.textContent?.trim()).toBe(SUBTOTAL);
    expect(byId(el, 'cart-empty')).toBeNull();
  });

  // The stepper stops at the minimum and maximum and changes the cart in between
  it('keeps the stepper within bounds and updates the cart', async () => {
    const { fixture, cart, el } = await mount([
      stored({ name: 'Min', dishId: 'min', quantity: 1 }),
      stored({ name: 'Max', dishId: 'max', quantity: MAX_QUANTITY }),
    ]);
    await settle(fixture);
    const lines = Array.from(el.querySelectorAll<HTMLElement>('li[app-cart-line]'));
    const step = (li: HTMLElement, which: 'decrease' | 'increase') =>
      li.querySelector<HTMLButtonElement>(`[data-testid="cart-line-${which}"]`)!;
    expect(step(lines[0], 'decrease').disabled).toBe(true);
    expect(step(lines[1], 'increase').disabled).toBe(true);

    // Stepping up changes the cart and is announced
    step(lines[0], 'increase').click();
    fixture.detectChanges();
    expect(cart.lines()[0].quantity).toBe(2);
    expect(byId(el, 'cart-announcer')?.textContent?.trim()).toBe('Min, quantity 2');
  });

  // Remove calls the service, announces it and moves focus to the next line's Remove button
  it('removes a line, announces it and moves focus to the next Remove button', async () => {
    const { fixture, cart, el } = await mount();
    await settle(fixture);
    const removeSpy = vi.spyOn(cart, 'remove');
    const [first, second] = cart.lines();
    removeButton(el, first.key).click();
    await settle(fixture);
    expect(removeSpy).toHaveBeenCalledWith(first.key);
    expect(cart.lines().length).toBe(2);
    expect(byId(el, 'cart-announcer')?.textContent?.trim()).toBe('Bulgogi removed');
    expect(document.activeElement?.getAttribute('data-remove')).toBe(second.key);
  });

  // Removing the last line falls back to the previous line, then to the heading
  it('focuses the previous line, then the heading, as lines run out', async () => {
    const { fixture, cart, el } = await mount([LINES[0], LINES[1]]);
    await settle(fixture);
    const [first, second] = cart.lines();
    // Last line removed: focus goes back to the previous one
    removeButton(el, second.key).click();
    await settle(fixture);
    expect(document.activeElement?.getAttribute('data-remove')).toBe(first.key);
    // Only line removed: the cart is empty and the heading takes focus
    removeButton(el, first.key).click();
    await settle(fixture);
    expect(byId(el, 'cart-empty')).toBeTruthy();
    expect(document.activeElement).toBe(el.querySelector('h1'));
  });

  // Delivery swaps checkout for the Uber Eats link and freezes the lines without touching the cart
  it('shows the delivery hand-off in delivery mode and leaves the cart alone', async () => {
    const { fixture, cart, el } = await mount();
    await settle(fixture);
    const before = JSON.stringify(cart.lines());
    radio(el, 'delivery').click();
    await settle(fixture);
    const link = el.querySelector<HTMLAnchorElement>('app-delivery-panel a')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(byId(el, 'cart-lines')?.hasAttribute('inert')).toBe(true);
    // The state is shown by a dashed frame and a label, not by faded text
    expect(byId(el, 'cart-lines')?.className).toContain('border-dashed');
    expect(byId(el, 'cart-lines')?.className).not.toContain('opacity-50');
    expect(byId(el, 'cart-delivery-note')?.textContent?.trim()).toBe(
      'Delivery orders are placed on Uber Eats',
    );
    expect(byId(el, 'cart-checkout')).toBeNull();
    expect(JSON.stringify(cart.lines())).toBe(before);
  });

  // Going back to takeout brings the checkout button and the live lines back
  it('restores checkout and the lines when switching back to takeout', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    radio(el, 'delivery').click();
    await settle(fixture);
    radio(el, 'takeout').click();
    await settle(fixture);
    expect(el.querySelector('app-delivery-panel')).toBeNull();
    expect(byId(el, 'cart-checkout')).toBeTruthy();
    expect(byId(el, 'cart-lines')?.hasAttribute('inert')).toBe(false);
    expect(byId(el, 'cart-lines')?.className).not.toContain('border-dashed');
    expect(byId(el, 'cart-delivery-note')).toBeNull();
  });

  // Checkout is a real disabled button explained by a visible note
  it('shows a disabled Checkout button described by the coming-soon note', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const button = byId(el, 'cart-checkout') as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent?.trim()).toBe('Checkout');
    expect(button.disabled).toBe(true);
    const note = el.querySelector(`#${button.getAttribute('aria-describedby')}`);
    expect(note?.textContent?.trim()).toBe('Online checkout is coming soon');
  });

  // The receipt card comes with its small-screen subtotal bar
  it('renders the receipt layout with the sticky subtotal bar', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    expect(byId(el, 'cart-layout-receipt')).toBeTruthy();
    expect(byId(el, 'cart-sticky-bar')?.textContent).toContain(SUBTOTAL);
  });

  // Line headings (h3) sit under an Items h2, which sits under the page h1
  it('has an Items h2 above the line headings', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const headings = Array.from(el.querySelectorAll('h1, h2, h3')).map((h) => h.tagName);
    expect(headings.slice(0, 3)).toEqual(['H1', 'H2', 'H3']);
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Items');
  });

  // A cart total of zero never shows the menu placeholder
  it('shows $0 in the sticky bar for an unpriced cart, never $00', async () => {
    const { fixture, el } = await mount([stored({ unitMinor: 0 })]);
    await settle(fixture);
    expect(byId(el, 'cart-sticky-bar')?.textContent).toContain('$0');
    expect(el.textContent).not.toContain('$00');
  });

  // Promo input is acknowledged only; the subtotal never moves
  it('leaves the subtotal unchanged when a promo code is applied', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const input = el.querySelector<HTMLInputElement>('app-promo-field input')!;
    input.value = 'SAVE10';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('app-promo-field form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await settle(fixture);
    expect(byId(el, 'cart-summary-subtotal')?.textContent?.trim()).toBe(SUBTOTAL);
  });
});

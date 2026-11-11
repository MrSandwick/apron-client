import { Component, Provider, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CartLine, MAX_QUANTITY, NewCartLine } from '../../core/cart/cart.model';
import { CART_STORAGE_KEY, CartService } from '../../core/cart/cart.service';
import { CartPage } from './cart';
import { CartPrinterIntro } from './intro/printer-intro';
import { WEBGL_PROBE } from './intro/webgl';

// Lets a test decide whether WebGL counts as available for the printer intro
const webgl = { available: true };

// Stand-in for the printer intro: same selector and outputs, no scene, but a Skip button to hold focus
@Component({ selector: 'app-cart-printer-intro', template: '<button type="button">Skip</button>' })
class IntroStub {
  readonly started = output<void>();
  readonly reveal = output<void>();
  readonly done = output<void>();
}

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
    providers: [
      provideRouter([]),
      // The probe reads the shared flag when asked, so a test can flip it before mounting
      { provide: WEBGL_PROBE, useValue: () => webgl.available },
      ...extra,
    ],
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
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['intro'];
    document.documentElement.classList.remove('overflow-hidden');
  });

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
    // The bokeh backdrop waits for the saved cart too, so the first client render matches the server
    expect(el.querySelector('app-cart-backdrop')).toBeNull();
    // The placeholder and the page around it carry none of the receipt motion
    expect(byId(el, 'cart-receipt-print')).toBeNull();
    expect(byId(el, 'cart-loading')?.className).not.toMatch(
      /animate-(receipt-print|stamp-in|line-out|fade-up)/,
    );
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

  // Under TestBed the leave animation is off, so a removed line leaves the DOM at once
  it('drops the removed line from the list immediately', async () => {
    const { fixture, cart, el } = await mount();
    await settle(fixture);
    removeButton(el, cart.lines()[0].key).click();
    await settle(fixture);
    expect(el.querySelectorAll('ul > li[app-cart-line]').length).toBe(2);
  });

  // The mascot is delighted on the receipt, waves for delivery and returns for takeout
  it('switches the mascot between delighted and waving with the mode', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const mood = () => el.querySelector('app-ahjoomah-face')?.getAttribute('data-mood');
    expect(mood()).toBe('delighted');
    radio(el, 'delivery').click();
    await settle(fixture);
    expect(mood()).toBe('waving');
    radio(el, 'takeout').click();
    await settle(fixture);
    expect(mood()).toBe('delighted');
  });

  // The mascot and the torn edge are decoration only
  it('hides the mascot and the torn edge from assistive tech', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    expect(el.querySelector('app-ahjoomah-face')?.getAttribute('aria-hidden')).toBe('true');
    const edge = byId(el, 'cart-tear-edge');
    expect(edge).toBeTruthy();
    expect(edge?.getAttribute('aria-hidden')).toBe('true');
  });

  // A late second remove for a line that is already gone must do nothing
  it('ignores a second remove of a line that was already removed', async () => {
    const { fixture, cart, el } = await mount();
    await settle(fixture);
    const page = fixture.componentInstance as unknown as {
      removeLine(line: CartLine): void;
    };
    const [first, second] = cart.lines();
    page.removeLine(first);
    await settle(fixture);
    expect(document.activeElement?.getAttribute('data-remove')).toBe(second.key);
    expect(byId(el, 'cart-announcer')?.textContent?.trim()).toBe('Bulgogi removed');

    // Move focus away, then repeat the remove with a stale copy under a different name
    el.querySelector<HTMLElement>('h1')!.focus();
    const removeSpy = vi.spyOn(cart, 'remove');
    page.removeLine({ ...first, name: 'Ghost' });
    await settle(fixture);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(el.querySelector('h1'));
    expect(byId(el, 'cart-announcer')?.textContent?.trim()).toBe('Bulgogi removed');
  });

  // A quantity change for a missing line must not touch the cart, the announcement or the mascot
  it('ignores a quantity change for a line that is no longer in the cart', async () => {
    const { fixture, cart, el } = await mount();
    await settle(fixture);
    const page = fixture.componentInstance as unknown as {
      removeLine(line: CartLine): void;
      changeQuantity(line: CartLine, quantity: number): void;
    };
    const first = cart.lines()[0];
    page.removeLine(first);
    await settle(fixture);
    const face = el.querySelector('app-ahjoomah-face');
    const announced = byId(el, 'cart-announcer')?.textContent?.trim();
    const setSpy = vi.spyOn(cart, 'setQuantity');

    // Raising the quantity would normally announce it and re-create the mascot
    page.changeQuantity(first, first.quantity + 1);
    await settle(fixture);
    expect(setSpy).not.toHaveBeenCalled();
    expect(byId(el, 'cart-announcer')?.textContent?.trim()).toBe(announced);
    expect(el.querySelector('app-ahjoomah-face')).toBe(face);
  });

  // The ticket card is rounded on top only, so the torn edge can finish it
  it('rounds only the top of the ticket card', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const card = byId(el, 'cart-receipt-print')?.querySelector('.rounded-t-3xl');
    expect(card).toBeTruthy();
    expect(card?.classList.contains('rounded-3xl')).toBe(false);
  });

  // A higher quantity re-creates the mascot so it hops; a lower one leaves it alone
  it('re-creates the mascot only when a quantity goes up', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    const first = el.querySelector('li[app-cart-line]')!;
    const face = el.querySelector('app-ahjoomah-face');
    // Decrease keeps the same element
    first.querySelector<HTMLButtonElement>('[data-testid="cart-line-decrease"]')!.click();
    await settle(fixture);
    expect(el.querySelector('app-ahjoomah-face')).toBe(face);
    // Increase swaps in a fresh one
    first.querySelector<HTMLButtonElement>('[data-testid="cart-line-increase"]')!.click();
    await settle(fixture);
    const fresh = el.querySelector('app-ahjoomah-face');
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(face);
  });

  // The test-setup matchMedia stub reports no motion preference, so the tween jumps and both subtotals match at once
  it('shows the new formatted subtotal at once after a quantity change', async () => {
    const { fixture, el } = await mount();
    await settle(fixture);
    el.querySelector<HTMLButtonElement>('[data-testid="cart-line-increase"]')!.click();
    await settle(fixture);
    // 3 x 12.50 + 10 + 9
    expect(byId(el, 'cart-summary-subtotal')?.textContent?.trim()).toBe('$56.50');
    expect(byId(el, 'cart-sticky-bar')?.textContent).toContain('$56.50');
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

  // The printer intro is the default entrance whenever motion, WebGL and a filled cart allow it
  describe('printer intro', () => {
    beforeEach(() => {
      webgl.available = true;
      // jsdom does not implement scrolling
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Reports no-preference for motion, which the test-setup stub never does
    const allowMotion = () =>
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('no-preference'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }));

    // Swaps the real intro for the stub, then mounts the page
    async function mountPrinter(lines: NewCartLine[] = LINES) {
      TestBed.overrideComponent(CartPage, {
        remove: { imports: [CartPrinterIntro] },
        add: { imports: [IntroStub] },
      });
      const mounted = await mount(lines);
      await settle(mounted.fixture);
      return mounted;
    }

    const overlay = (fixture: ComponentFixture<CartPage>) =>
      fixture.debugElement.query(By.css('app-cart-printer-intro'));

    // Emits one of the stub's outputs, then renders the result
    async function emit(fixture: ComponentFixture<CartPage>, name: 'started' | 'reveal' | 'done') {
      (overlay(fixture).componentInstance as IntroStub)[name].emit();
      await settle(fixture);
    }

    const rootIntro = () => document.documentElement.dataset['intro'];

    const backdropReady = (fixture: ComponentFixture<CartPage>) =>
      (fixture.componentInstance as unknown as { backdropReady(): boolean }).backdropReady();

    // Reduced motion (the default test stub) skips the intro and leaves the page untouched
    it('shows no overlay and visible content under reduced motion', async () => {
      const { fixture, el } = await mountPrinter();
      expect(overlay(fixture)).toBeNull();
      // Without an intro the bokeh backdrop is allowed straight away
      expect(backdropReady(fixture)).toBe(true);
      const layout = byId(el, 'cart-layout-receipt')!;
      expect(layout.hasAttribute('inert')).toBe(false);
      expect(layout.className).not.toContain('opacity-0');
      expect(byId(el, 'cart-lines')).toBeTruthy();
      expect(rootIntro()).toBeUndefined();
    });

    // Without WebGL there is nothing to draw, so the page shows at once
    it('skips the intro when WebGL is unavailable', async () => {
      allowMotion();
      webgl.available = false;
      const { fixture, el } = await mountPrinter();
      expect(overlay(fixture)).toBeNull();
      expect(byId(el, 'cart-layout-receipt')?.hasAttribute('inert')).toBe(false);
      expect(rootIntro()).toBeUndefined();
    });

    // The parts that change with the cart; the 3D ticket leaves their space blank
    const dynamicParts = (el: HTMLElement) => [
      ...Array.from(el.querySelectorAll<HTMLElement>('li[app-cart-line]')),
      byId(el, 'cart-summary-count')!,
      byId(el, 'cart-summary-subtotal')!,
      byId(el, 'cart-count')!,
      byId(el, 'cart-mascot')!,
    ];

    // The parts that never change: they sit on the 3D ticket and must never hide or stamp
    const staticParts = (el: HTMLElement) => [
      el.querySelector<HTMLElement>('app-fulfillment-toggle')!,
      el.querySelector<HTMLElement>('[data-intro-target] > div[aria-hidden="true"]')!,
      el.querySelector<HTMLElement>('app-cart-summary')!,
      el.querySelector<HTMLElement>('app-promo-field')!,
      byId(el, 'cart-checkout')!,
    ];

    // The 3D ticket skips exactly the lines list and the two summary values
    it('marks the lines list and the two summary values as dynamic', async () => {
      const { el } = await mountPrinter();
      const marked = Array.from(el.querySelectorAll('[data-intro-dynamic]')).map((node) =>
        node.getAttribute('data-testid'),
      );
      expect(marked).toEqual(['cart-lines', 'cart-summary-count', 'cart-summary-subtotal']);
      // All three sit inside the card the ticket copies
      expect(el.querySelectorAll('[data-intro-target] [data-intro-dynamic]')).toHaveLength(3);
    });

    // The receipt waits transparent until the overlay is up, then is laid out under it
    it('keeps the receipt inert and see-through only until the overlay is up', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();
      const layout = byId(el, 'cart-layout-receipt')!;
      const title = byId(el, 'cart-title')!.parentElement!;
      expect(overlay(fixture)).toBeTruthy();
      expect(layout.hasAttribute('inert')).toBe(true);
      expect(layout.className).toContain('opacity-0');
      // Hidden by opacity only, so its measured rect is the final one the ticket lands on
      expect(layout.className).not.toContain('scale-');
      expect(el.querySelector('[data-intro-target]')?.className).toContain('bg-dusk-card');
      expect(title.className).not.toContain('opacity-0');
      // No bokeh while the 3D scene is pending
      expect(backdropReady(fixture)).toBe(false);
      expect(el.querySelector('app-cart-backdrop')).toBeNull();

      // Playing: the overlay covers the page, so the card is laid out visibly beneath it
      await emit(fixture, 'started');
      expect(layout.hasAttribute('inert')).toBe(true);
      expect(layout.className).not.toContain('opacity-0');
      expect(title.className).toContain('opacity-0');
      expect(backdropReady(fixture)).toBe(false);

      // Revealing: the page is live, the overlay fades, and there is still no print-out entrance
      await emit(fixture, 'reveal');
      expect(layout.hasAttribute('inert')).toBe(false);
      expect(title.className).not.toContain('opacity-0');
      expect(overlay(fixture)).toBeTruthy();
      expect(backdropReady(fixture)).toBe(false);
      expect(byId(el, 'cart-receipt-print')?.className).not.toContain('animate-receipt-print');

      // Done: the overlay is removed and only now may the bokeh backdrop appear
      await emit(fixture, 'done');
      expect(overlay(fixture)).toBeNull();
      expect(layout.hasAttribute('inert')).toBe(false);
      expect(backdropReady(fixture)).toBe(true);
      expect(byId(el, 'cart-receipt-print')?.className).not.toContain('animate-receipt-print');
    });

    // Static text and controls are never hidden; only the dynamic parts wait for the reveal
    it('hides only the dynamic parts until the reveal, then stamps them in', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();

      // Before the reveal the dynamic parts are invisible and static ones are untouched
      await emit(fixture, 'started');
      expect(dynamicParts(el)).toHaveLength(7);
      for (const part of dynamicParts(el)) {
        expect(part.className).toContain('opacity-0');
        expect(part.className).not.toContain('animate-stamp-in');
      }
      for (const part of staticParts(el)) {
        expect(part.className).not.toContain('opacity-0');
        expect(part.className).not.toContain('animate-stamp-in');
      }

      // Reveal: the dynamic parts stamp in, the static ones still carry no motion class
      await emit(fixture, 'reveal');
      for (const part of dynamicParts(el)) {
        expect(part.className).toContain('motion-safe:animate-stamp-in');
        expect(part.className).not.toContain('opacity-0');
      }
      for (const part of staticParts(el)) {
        expect(part.className).not.toContain('animate-stamp-in');
      }

      // Staggered: lines 90 ms apart, then the summary values and header count, then the mascot
      const delay = (node: HTMLElement) => node.style.getPropertyValue('--stamp-delay');
      const lines = el.querySelectorAll<HTMLElement>('li[app-cart-line]');
      expect(delay(lines[0])).toBe('90ms');
      expect(delay(lines[1])).toBe('180ms');
      expect(delay(lines[2])).toBe('270ms');
      expect(delay(el.querySelector<HTMLElement>('app-cart-summary')!)).toBe('360ms');
      expect(delay(byId(el, 'cart-count')!)).toBe('360ms');
      expect(delay(byId(el, 'cart-mascot')!)).toBe('450ms');
      // The enter animations do not also play the print-out
      expect(byId(el, 'cart-receipt-print')?.className).not.toContain('animate-receipt-print');
    });

    // The subtotal is fed 0 until the summary stamps in, so it counts up from nothing
    it('feeds the subtotal 0 until the stamp reaches the summary, then the real total', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();
      const subtotal = () => byId(el, 'cart-summary-subtotal')!.textContent?.trim();
      const bar = () => byId(el, 'cart-sticky-bar')!.textContent;
      await emit(fixture, 'started');
      expect(subtotal()).toBe('$0');
      expect(bar()).toContain('$0');

      vi.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'performance',
        ],
      });
      try {
        (overlay(fixture).componentInstance as IntroStub).reveal.emit();
        fixture.detectChanges();
        // Revealed but the summary has not started to stamp: still nothing to count
        vi.advanceTimersByTime(300);
        fixture.detectChanges();
        expect(subtotal()).toBe('$0');

        // The summary's delay has passed: the tween runs up to the real total
        vi.advanceTimersByTime(100);
        fixture.detectChanges();
        vi.advanceTimersByTime(1000);
        fixture.detectChanges();
        expect(subtotal()).toBe(SUBTOTAL);
        expect(bar()).toContain(SUBTOTAL);
      } finally {
        vi.useRealTimers();
      }
    });

    // The stamp classes are dropped once the last stamp has played
    it('removes the stamp classes after the stamp window', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();
      await emit(fixture, 'started');
      vi.useFakeTimers();
      try {
        (overlay(fixture).componentInstance as IntroStub).reveal.emit();
        fixture.detectChanges();
        expect(dynamicParts(el)[0].className).toContain('animate-stamp-in');
        vi.advanceTimersByTime(3000);
        fixture.detectChanges();
        for (const part of dynamicParts(el))
          expect(part.className).not.toContain('animate-stamp-in');
      } finally {
        vi.useRealTimers();
      }
    });

    // Reduced motion or no WebGL: nothing is hidden, nothing stamps, the subtotal is the real one
    it('keeps everything visible and unstamped when the intro never runs', async () => {
      const { el } = await mountPrinter();
      for (const part of [...dynamicParts(el), ...staticParts(el)]) {
        expect(part.className).not.toContain('opacity-0');
        expect(part.className).not.toContain('animate-stamp-in');
      }
      expect(byId(el, 'cart-summary-subtotal')?.textContent?.trim()).toBe(SUBTOTAL);
    });

    // The navbar's slide is keyed on this attribute: set while the intro plays, gone at the reveal
    it('sets data-intro on the root from the pending intro until the reveal', async () => {
      allowMotion();
      const { fixture } = await mountPrinter();
      expect(rootIntro()).toBe('playing');
      await emit(fixture, 'started');
      expect(rootIntro()).toBe('playing');
      await emit(fixture, 'reveal');
      expect(rootIntro()).toBeUndefined();
      await emit(fixture, 'done');
      expect(rootIntro()).toBeUndefined();
    });

    // Leaving the page mid-intro must not leave the navbar parked off screen
    it('removes data-intro when the page is destroyed during the intro', async () => {
      allowMotion();
      const { fixture } = await mountPrinter();
      expect(rootIntro()).toBe('playing');
      fixture.destroy();
      expect(rootIntro()).toBeUndefined();
    });

    // An empty cart has no ticket to print
    it('shows no overlay and no data-intro for an empty cart', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter([]);
      expect(overlay(fixture)).toBeNull();
      expect(byId(el, 'cart-empty')).toBeTruthy();
      expect(rootIntro()).toBeUndefined();
      // The intro is skipped, so the backdrop is allowed
      expect(backdropReady(fixture)).toBe(true);
    });

    const html = () => document.documentElement;

    // Records timers so a test can run the page's safety timer by hand, and see what it clears
    function recordTimers() {
      const set = vi.spyOn(globalThis, 'setTimeout');
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      const safety = () => {
        const index = set.mock.calls.findIndex((call) => call[1] === 3000);
        return {
          found: index >= 0,
          run: () => (set.mock.calls[index][0] as unknown as () => void)(),
          id: set.mock.results[index]?.value,
        };
      };
      return { clear, safety };
    }

    // The overlay chunk may fail to load, so the page must not wait on it forever
    it('shows the page without the intro when the overlay never starts', async () => {
      allowMotion();
      const timers = recordTimers();
      const { fixture, el } = await mountPrinter();
      const layout = byId(el, 'cart-layout-receipt')!;
      expect(layout.hasAttribute('inert')).toBe(true);
      expect(rootIntro()).toBe('playing');

      // The safety timer fires with no word from the overlay: reveal, then done
      const safety = timers.safety();
      expect(safety.found).toBe(true);
      safety.run();
      await settle(fixture);
      expect(overlay(fixture)).toBeNull();
      expect(layout.hasAttribute('inert')).toBe(false);
      expect(layout.className).not.toContain('opacity-0');
      for (const part of dynamicParts(el)) expect(part.className).not.toContain('opacity-0');
      expect(byId(el, 'cart-title')!.parentElement!.className).not.toContain('opacity-0');
      expect(rootIntro()).toBeUndefined();
      expect(html().classList).not.toContain('overflow-hidden');
      expect(backdropReady(fixture)).toBe(true);
    });

    // Any sign of life from the overlay cancels the safety timer
    it.each(['started', 'reveal', 'done'] as const)(
      'stops the safety timer when the overlay emits %s',
      async (name) => {
        allowMotion();
        const timers = recordTimers();
        const { fixture } = await mountPrinter();
        const { id } = timers.safety();
        expect(id).toBeDefined();
        timers.clear.mockClear();
        await emit(fixture, name);
        expect(timers.clear).toHaveBeenCalledWith(id);
      },
    );

    it('stops the safety timer when the page is destroyed while the overlay is silent', async () => {
      allowMotion();
      const timers = recordTimers();
      const { fixture } = await mountPrinter();
      const { id } = timers.safety();
      timers.clear.mockClear();
      fixture.destroy();
      expect(timers.clear).toHaveBeenCalledWith(id);
    });

    // Another tab can empty the saved cart while the intro runs; nothing may stay hidden or inert
    it.each(['pending', 'playing', 'revealing'] as const)(
      'ends the intro cleanly when the cart is emptied while %s',
      async (phase) => {
        allowMotion();
        const { fixture, cart, el } = await mountPrinter();
        if (phase !== 'pending') await emit(fixture, 'started');
        if (phase === 'revealing') await emit(fixture, 'reveal');
        expect(overlay(fixture)).toBeTruthy();
        // Focus is on the overlay's Skip button
        overlay(fixture).nativeElement.querySelector('button').focus();

        for (const line of [...cart.lines()]) cart.remove(line.key);
        await settle(fixture);
        expect(overlay(fixture)).toBeNull();
        expect(byId(el, 'cart-empty')).toBeTruthy();
        expect(backdropReady(fixture)).toBe(true);
        expect(byId(el, 'cart-title')!.parentElement!.className).not.toContain('opacity-0');
        // The root hooks are released and focus lands on the heading, not on the body
        expect(rootIntro()).toBeUndefined();
        expect(html().classList).not.toContain('overflow-hidden');
        expect(document.activeElement).toBe(byId(el, 'cart-title'));
      },
    );

    // Skip button focus must not be lost to the body when the page goes live
    it('moves focus from the overlay to the heading at the reveal', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();
      const skip = overlay(fixture).nativeElement.querySelector('button') as HTMLButtonElement;
      skip.focus();
      expect(document.activeElement).toBe(skip);
      await emit(fixture, 'started');
      expect(document.activeElement).toBe(skip);

      await emit(fixture, 'reveal');
      expect(document.activeElement).toBe(byId(el, 'cart-title'));
    });

    it('leaves focus alone at the reveal when it was not in the overlay', async () => {
      allowMotion();
      const { fixture, el } = await mountPrinter();
      await emit(fixture, 'reveal');
      expect(document.activeElement).not.toBe(byId(el, 'cart-title'));
    });

    // The page behind the overlay does not scroll, and starts at the top
    it('locks scrolling and scrolls to the top while the intro plays', async () => {
      allowMotion();
      const { fixture } = await mountPrinter();
      expect(html().classList).toContain('overflow-hidden');
      expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, left: 0 }));
      await emit(fixture, 'started');
      expect(html().classList).toContain('overflow-hidden');

      // Released at the reveal
      await emit(fixture, 'reveal');
      expect(html().classList).not.toContain('overflow-hidden');
    });

    it('releases the scroll lock when the page is destroyed during the intro', async () => {
      allowMotion();
      const { fixture } = await mountPrinter();
      expect(html().classList).toContain('overflow-hidden');
      fixture.destroy();
      expect(html().classList).not.toContain('overflow-hidden');
    });

    // A skipped intro emits reveal and done together; nothing is left set on the root
    it('clears the root hooks when the overlay reveals and finishes at once', async () => {
      allowMotion();
      const { fixture } = await mountPrinter();
      const stub = overlay(fixture).componentInstance as IntroStub;
      stub.reveal.emit();
      stub.done.emit();
      await settle(fixture);
      expect(rootIntro()).toBeUndefined();
      expect(html().classList).not.toContain('overflow-hidden');
    });

    it('sets no scroll lock when the intro never runs', async () => {
      await mountPrinter();
      expect(html().classList).not.toContain('overflow-hidden');
      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });
});

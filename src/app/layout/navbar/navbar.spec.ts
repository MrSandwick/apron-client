import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CART_STORAGE_KEY, CartService } from '../../core/cart/cart.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    // In-memory storage so the cart never touches the real one
    const data: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    });
    // Router is provided so the nav routerLinks resolve to hrefs.
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the brand and links to every page in the set', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Ahjoomah's");
    // Home, menu, reserve, and cart are all reachable from the nav.
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/home');
    expect(hrefs).toContain('/menu');
    expect(hrefs).toContain('/reserve');
    expect(hrefs).toContain('/cart');
    expect(hrefs).not.toContain('/order');
  });

  // The bar rides off the top while the cart intro plays, and springs back when it ends
  it('slides off the top while data-intro is playing, and not under reduced motion', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('header')!;
    const classes = header.classList;
    expect(classes).toContain('transition-[translate,visibility]');
    expect(classes).toContain('duration-500');
    expect(classes).toContain('ease-spring');
    expect(classes).toContain('in-data-[intro=playing]:-translate-y-full');
    // Hidden too, so the off-screen links leave the tab order; the visibility flip waits for the slide
    expect(classes).toContain('in-data-[intro=playing]:invisible');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('labels the cart action for assistive tech', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Icon-only link needs an accessible name.
    const cart = el.querySelector('a[aria-label="Cart"]');
    expect(cart?.getAttribute('href')).toBe('/cart');
  });

  // Adds portions straight to the cart service the navbar reads
  function addToCart(quantity: number) {
    TestBed.inject(CartService).add({
      dishId: 'd1',
      name: 'Galbi',
      quantity,
      picks: [],
      note: '',
      unitMinor: 2000,
      currency: 'USD',
    });
  }

  it('hides the cart count badge while the cart is empty', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // No badge and the plain label at zero items.
    expect(el.querySelector('a[href="/cart"] span')).toBeNull();
    expect(el.querySelector('a[href="/cart"]')?.getAttribute('aria-label')).toBe('Cart');
  });

  it('shows the cart count in a badge', () => {
    const fixture = TestBed.createComponent(Navbar);
    addToCart(3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // The badge shows the number of portions.
    expect(el.querySelector('a[href="/cart"] span')?.textContent?.trim()).toBe('3');
  });

  it('includes the count in the cart label, singular for one item', () => {
    const fixture = TestBed.createComponent(Navbar);
    addToCart(1);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cart = el.querySelector('a[href="/cart"]');
    expect(cart?.getAttribute('aria-label')).toBe('Cart, 1 item');
    // More portions switch to the plural.
    addToCart(1);
    fixture.detectChanges();
    expect(cart?.getAttribute('aria-label')).toBe('Cart, 2 items');
  });

  const POP_CLASS = 'motion-safe:animate-badge-pop';

  // Stores a cart with the given portions so the service loads it on first render
  function storeCart(quantity: number) {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        lines: [
          {
            dishId: 'd1',
            name: 'Galbi',
            quantity,
            picks: [],
            note: '',
            unitMinor: 2000,
            currency: 'USD',
          },
        ],
      }),
    );
  }

  // Renders the navbar and waits until the cart has been read from storage
  async function renderReady() {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(CartService).ready()).toBe(true);
    return fixture;
  }

  const badge = (fixture: { nativeElement: unknown }) =>
    (fixture.nativeElement as HTMLElement).querySelector('a[href="/cart"] span');

  it('does not pop the badge for a cart loaded from storage', async () => {
    storeCart(2);
    const fixture = await renderReady();
    // The stored count shows, but the load must not trigger the pop class
    expect(badge(fixture)?.textContent?.trim()).toBe('2');
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(false);
  });

  it('pops the badge when an add increases the count', async () => {
    storeCart(2);
    const fixture = await renderReady();
    addToCart(1);
    fixture.detectChanges();
    // The new count shows and the badge carries the pop class
    expect(badge(fixture)?.textContent?.trim()).toBe('3');
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(true);
  });

  it('pops the badge for the first item added to an empty cart', async () => {
    const fixture = await renderReady();
    addToCart(1);
    fixture.detectChanges();
    // The badge appears fresh and pops
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(true);
  });

  it('does not pop the badge when the count decreases', async () => {
    storeCart(3);
    const fixture = await renderReady();
    const cart = TestBed.inject(CartService);
    cart.setQuantity(cart.lines()[0].key, 1);
    fixture.detectChanges();
    // A lower count updates the number without the pop class
    expect(badge(fixture)?.textContent?.trim()).toBe('1');
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(false);
  });

  it('drops the pop class again when the count decreases after an add', async () => {
    storeCart(1);
    const fixture = await renderReady();
    addToCart(2);
    fixture.detectChanges();
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(true);
    // Removing portions afterwards clears the class
    const cart = TestBed.inject(CartService);
    cart.setQuantity(cart.lines()[0].key, 1);
    fixture.detectChanges();
    expect(badge(fixture)?.classList.contains(POP_CLASS)).toBe(false);
  });

  it('keeps the mobile menu collapsed until the toggle is pressed', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // On first render the panel is absent and the toggle reports collapsed.
    const toggle = el.querySelector('button[aria-controls="mobile-menu"]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#mobile-menu')).toBeNull();
  });

  it('reveals the mobile menu links when the toggle is pressed', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Pressing the hamburger opens the panel and flips aria-expanded.
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]')!;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = el.querySelector('#mobile-menu');
    expect(panel).toBeTruthy();
    // The collapsed links (and the reservation CTA) live inside the panel.
    const hrefs = Array.from(panel!.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/home');
    expect(hrefs).toContain('/menu');
    expect(hrefs).toContain('/reserve');
  });

  it('collapses the mobile menu again when the toggle is pressed twice', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Toggling open then closed removes the panel from the DOM.
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls="mobile-menu"]')!;
    toggle.click();
    fixture.detectChanges();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#mobile-menu')).toBeNull();
  });
});

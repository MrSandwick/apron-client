import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';

describe('Navbar', () => {
  beforeEach(async () => {
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
    // Home, menu, reserve, and order are all reachable from the nav.
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/home');
    expect(hrefs).toContain('/menu');
    expect(hrefs).toContain('/reserve');
    expect(hrefs).toContain('/order');
  });

  it('labels the cart action for assistive tech', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Icon-only link needs an accessible name.
    const cart = el.querySelector('a[aria-label="Cart"]');
    expect(cart?.getAttribute('href')).toBe('/order');
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

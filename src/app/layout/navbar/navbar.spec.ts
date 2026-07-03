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
});

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Footer } from './footer';

describe('Footer', () => {
  beforeEach(async () => {
    // Router is provided so the Quick Links routerLinks resolve to hrefs.
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the brand and quick links to every page', () => {
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Ahjoomah's");
    // Quick Links cover the whole page set.
    const hrefs = Array.from(el.querySelectorAll('nav a, ul a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/home', '/menu', '/reserve', '/order']));
  });

  it('exposes contact links and a labelled newsletter field', () => {
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Email and phone are real links.
    expect(el.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(el.querySelector('a[href^="tel:"]')).toBeTruthy();
    // Email input is present and accessibly labelled.
    const email = el.querySelector('input#newsletter-email');
    expect(email?.getAttribute('type')).toBe('email');
    expect(el.querySelector('label[for="newsletter-email"]')).toBeTruthy();
  });

  it('has four labelled social buttons and no emoji credit', () => {
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    for (const name of ['Instagram', 'TikTok', 'X', 'YouTube']) {
      expect(el.querySelector(`button[aria-label="${name}"]`)).toBeTruthy();
    }
    // Guards the no-emoji rule: the credit uses an SVG, not the literal flame.
    expect(el.textContent).toContain('Made with');
    expect(el.textContent).not.toContain('🔥');
  });

  it('prevents the placeholder newsletter submit from reloading', () => {
    const fixture = TestBed.createComponent(Footer);
    // Cancelable event so preventDefault is observable via defaultPrevented.
    const event = new Event('submit', { cancelable: true });
    fixture.componentInstance.onSubmit(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

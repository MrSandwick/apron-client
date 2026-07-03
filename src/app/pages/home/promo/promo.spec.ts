import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePromo } from './promo';

describe('HomePromo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePromo],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the promo heading and price', () => {
    const fixture = TestBed.createComponent(HomePromo);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-promo"]')).toBeTruthy();
    expect(el.querySelector('h2')?.textContent).toContain('Unlimited KBBQ Night');
    expect(el.textContent).toContain('$35 / person');
  });

  it('links "See Full Menu" to /menu and keeps "Claim This Deal" as a placeholder button', () => {
    const fixture = TestBed.createComponent(HomePromo);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const menuLink = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('See Full Menu'),
    );
    expect(menuLink?.getAttribute('href')).toBe('/menu');

    const claim = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Claim This Deal'),
    );
    expect(claim).toBeTruthy();
  });

  it('uses no emoji in the HOT DEAL badge', () => {
    const fixture = TestBed.createComponent(HomePromo);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('HOT');
    expect(el.textContent).not.toContain('🔥');
  });
});

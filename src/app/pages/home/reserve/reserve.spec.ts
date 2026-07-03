import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeReserve } from './reserve';

describe('HomeReserve', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeReserve],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the heading and all feature bullets', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-reserve"]')).toBeTruthy();
    expect(el.querySelector('h2')?.textContent).toContain('Book Your');
    expect(el.querySelectorAll('ul > li').length).toBe(4);
    expect(el.textContent).toContain('Groups of 2 – 30 guests');
  });

  it('links "Reserve a Table" to /reserve and keeps the call CTA as a placeholder', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const reserve = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Reserve a Table'),
    );
    expect(reserve?.getAttribute('href')).toBe('/reserve');

    const call = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Or call us directly'),
    );
    expect(call).toBeTruthy();
  });
});

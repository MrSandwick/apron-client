import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeHero } from './hero';

describe('HomeHero', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeHero],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the hero heading and Korean subtitle', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-hero"]')).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain("Ahjoomah's Apron");
    expect(el.textContent).toContain('아주마스');
  });

  it('links the CTAs to /reserve and /menu', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/reserve');
    expect(hrefs).toContain('/menu');
  });
});

import { TestBed } from '@angular/core/testing';
import { HomeVisit } from './visit';

describe('HomeVisit', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeVisit] }).compileComponents();
  });

  // The one Chicago location renders, and Hours is a description list with one row per span
  it('renders Find Us locations and an Hours list', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-visit"]')).toBeTruthy();
    const text = el.textContent ?? '';
    expect(text).toContain('Chicago');
    expect(text).not.toContain('New York');
    expect(text).not.toContain('Los Angeles');
    expect(el.querySelectorAll('dl > div').length).toBe(3);
    expect(text).toContain('Mon – Thu');
    expect(text).toContain('Sunday');
  });

  // No map destination yet, so each "Get Directions" stays a button, sized as a 44px tap target
  it('keeps "Get Directions" as placeholder buttons with a full tap target', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const directions = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Get Directions'),
    );
    expect(directions.length).toBe(1);
    expect(directions.every((b) => b.classList.contains('min-h-11'))).toBe(true);
  });

  // Today's row gets the badge once the browser knows the weekday
  it('marks today in the hours once rendered in the browser', async () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Today');
  });

  // Sits in the evening part of the page, with Ahjoomah peeking over the hours
  it('renders in the evening with a peeking Ahjoomah', () => {
    const fixture = TestBed.createComponent(HomeVisit);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-visit"]')?.classList).toContain('from-sky-twilight');
    expect(el.querySelector('[data-testid="ahjoomah-peek"]')).toBeTruthy();
  });
});

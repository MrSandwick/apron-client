import { TestBed } from '@angular/core/testing';
import { HomeSteps } from './steps';

describe('HomeSteps', () => {
  it('renders the heading and all four rounds as a static list', () => {
    const fixture = TestBed.createComponent(HomeSteps);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-steps"]')).toBeTruthy();
    expect(el.querySelector('h2')?.textContent).toContain('Four rounds');
    expect(el.querySelectorAll('ol > li').length).toBe(4);
    expect(el.textContent).toContain('Fire up the grill');
  });

  // Each round carries a swappable dish image slot with its own illustration
  it('gives every round a dish art slot', () => {
    const fixture = TestBed.createComponent(HomeSteps);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const kinds = Array.from(el.querySelectorAll('ol > li [data-testid="dish-art"] svg')).map((s) =>
      s.getAttribute('data-kind'),
    );
    expect(kinds).toEqual(['rice', 'meat', 'grill', 'banchan']);
  });
});

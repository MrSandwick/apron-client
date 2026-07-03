import { TestBed } from '@angular/core/testing';
import { HomeAbout } from './about';

describe('HomeAbout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeAbout] }).compileComponents();
  });

  it('renders the story heading and both paragraphs anchor', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-about"]')).toBeTruthy();
    const h2 = el.querySelector('h2')?.textContent ?? '';
    expect(h2).toContain('Lorem Ipsum');
    expect(h2).toContain('Dolor Sit Amet');
  });

  it('renders Find Us locations and an Hours list', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('Lorem City');
    expect(text).toContain('Dolor City');
    // Hours as a semantic description list
    const rows = el.querySelectorAll('dl > div');
    expect(rows.length).toBe(3);
    expect(text).toContain('Mon – Thu');
    expect(text).toContain('Sunday');
  });

  it('keeps "Get Directions" as placeholder buttons and uses no emoji', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const directions = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Get Directions'),
    );
    expect(directions.length).toBe(2);
    expect(el.textContent).toContain('Since 2019');
    expect(el.textContent).not.toContain('🔥');
  });
});

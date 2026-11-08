import { TestBed } from '@angular/core/testing';
import { HomeAbout } from './about';

describe('HomeAbout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HomeAbout] }).compileComponents();
  });

  // The story heading keeps both placeholder lines
  it('renders the story heading', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-about"]')).toBeTruthy();
    const h2 = el.querySelector('h2')?.textContent ?? '';
    expect(h2).toContain('Lorem Ipsum');
    expect(h2).toContain('Dolor Sit Amet');
  });

  // Sits in the daylight part of the page with the engraved wood logo as its art
  it('renders in daylight with the wood logo and founding year', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const section = el.querySelector('[data-testid="home-about"]');
    expect(section?.classList).toContain('from-sky-noon');
    const art = el.querySelector('figure img');
    expect(art?.getAttribute('src')).toBe('images/ahjoomah-wood.svg');
    expect(art?.getAttribute('alt')).toContain('engraved');
    expect(el.textContent).toContain('Since 2019');
  });

  // Locations and hours moved out to HomeVisit, and no emoji sneaks into the art
  it('leaves Find Us and Hours to the visit section and uses no emoji', () => {
    const fixture = TestBed.createComponent(HomeAbout);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Find Us');
    expect(el.querySelector('dl')).toBeNull();
    // Guards the no-emoji rule: the feature art is an SVG, never an emoji.
    expect(el.textContent).not.toContain('\u{1F525}');
  });
});

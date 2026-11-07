import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeHero } from './hero';

describe('HomeHero', () => {
  beforeEach(async () => {
    // Router is provided so the CTA routerLinks resolve to hrefs.
    await TestBed.configureTestingModule({
      imports: [HomeHero],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  // The hero keeps only the headline and CTAs: no Korean subtitle, blurb or quick-facts strip
  it('renders a minimal hero: heading only, no subtitle, blurb or facts', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-hero"]')).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain("Ahjoomah's");
    expect(el.textContent).not.toContain('아주마스');
    expect(el.textContent).not.toContain('Authentic Korean flavors');
    expect(el.querySelector('dl')).toBeNull();
  });

  // The decorative parallax scene renders its layers, lanterns and smoke, hidden from assistive tech
  it('renders the parallax scene behind the copy', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const layers = el.querySelectorAll('[data-layer]');
    expect(layers.length).toBeGreaterThanOrEqual(5);
    expect(Array.from(layers).every((l) => l.hasAttribute('data-depth'))).toBe(true);
    expect(el.querySelectorAll('[data-lantern]').length).toBe(4);
    expect(el.querySelector('[data-smoke]')).toBeTruthy();
    expect(el.querySelector('app-hero-scene > div')?.getAttribute('aria-hidden')).toBe('true');
  });

  // Sound is opt-in, so the hero offers a toggle that starts off
  it('offers an opt-in sound toggle that starts off', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="sound-toggle"]');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  });

  it('links the CTAs to /reserve and /menu', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Both CTAs are anchors; assert their resolved routes.
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/reserve');
    expect(hrefs).toContain('/menu');
  });

  // Ahjoomah replaces the old 3D cube beside the copy
  it('shows Ahjoomah instead of the 3D cube', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-ahjoomah')).toBeTruthy();
    expect(el.querySelector('app-section-canvas')).toBeNull();
  });

  // Hovering Reserve switches her to happy eyes, and leaving switches back
  it('makes Ahjoomah happy while Reserve is hovered', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const reserve = el.querySelector<HTMLAnchorElement>('a[href="/reserve"]');
    expect(el.querySelector('[data-testid="eyes-open"]')).toBeTruthy();

    reserve?.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="eyes-happy"]')).toBeTruthy();

    reserve?.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="eyes-open"]')).toBeTruthy();
  });

  // On phones the tap is her main interaction: she's a labelled button and gets happy when tapped
  it('reacts with happy eyes when Ahjoomah is tapped', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('[data-testid="hero-mascot"]');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('aria-label')).toContain('Ahjoomah');

    button?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="eyes-happy"]')).toBeTruthy();
  });

  // The title reads as one phrase for assistive tech, with the mascot outside the heading
  it('keeps the heading text intact around the mascot', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent?.replace(/\s+/g, ' ').trim()).toBe("Ahjoomah's Apron");
    expect(h1?.querySelector('button')).toBeNull();
  });
});

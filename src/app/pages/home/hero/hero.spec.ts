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
    // Every decorative layer is hidden; only the stage (holding the mascot button) is exposed
    const decorative = Array.from(layers).filter((l) => !l.querySelector('[data-testid="hero-mascot"]'));
    expect(decorative.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true);
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

  // The title reads as one phrase, and the mascot stands in the scene's stage, not the heading
  it('keeps the heading text intact and puts the mascot on the scene stage', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const h1 = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(h1?.textContent?.replace(/\s+/g, ' ').trim()).toBe("Ahjoomah's Apron");
    expect(h1?.querySelector('button')).toBeNull();
    const stage = (fixture.nativeElement as HTMLElement).querySelector('[data-depth="0.45"]');
    expect(stage?.querySelector('[data-testid="hero-mascot"]')).toBeTruthy();
  });

  // Her frame clips only the bottom edge, so a tap hop or squash never chops the top of her head
  it('keeps the top of Ahjoomah unclipped while she hops', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const frame = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hero-mascot"] > span');
    expect(frame?.className).toContain('[clip-path:inset(-60%_-20%_0_-20%)]');
    expect(frame?.className).not.toContain('overflow-hidden');
  });

  // The rooftop SVG overflows its box, so chimney smoke rising past the top edge isn't sliced off
  it('lets the chimney smoke rise past the rooftop box', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const roof = (fixture.nativeElement as HTMLElement).querySelector('[data-smoke]')?.closest('svg');
    expect(roof?.getAttribute('class')).toContain('overflow-visible');
  });

  // Several clouds of different sizes, so the sky has depth when they drift at different speeds
  it('renders a varied set of clouds', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const clouds = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-cloud]');
    expect(clouds.length).toBe(5);
    expect(Array.from(clouds).every((c) => c.querySelectorAll('ellipse').length >= 2)).toBe(true);
  });

  // The eyebrow line names the one city the restaurant is in
  it('names Chicago in the eyebrow and no other city', () => {
    const fixture = TestBed.createComponent(HomeHero);
    fixture.detectChanges();
    const eyebrow = (fixture.nativeElement as HTMLElement).querySelector('.eyebrow')?.textContent ?? '';
    expect(eyebrow).toContain('Chicago');
    expect(eyebrow).not.toContain('New York');
    expect(eyebrow).not.toContain('Los Angeles');
  });
});

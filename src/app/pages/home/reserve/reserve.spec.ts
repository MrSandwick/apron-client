import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, vi } from 'vitest';
import { HomeReserve } from './reserve';

// Stubs the screen width query: wide is md or larger. Reduced-motion queries get the same answer,
// which only decides whether the scroll listener starts
function stubScreen(wide: boolean): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: wide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('HomeReserve', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(async () => {
    // Router is provided so the "Reserve a Table" routerLink resolves.
    await TestBed.configureTestingModule({
      imports: [HomeReserve],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  // Heading is two masked lines with the second in amber, and all four perks render as chips
  it('renders the heading and all feature bullets', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-reserve"]')).toBeTruthy();
    const h2 = el.querySelector('h2');
    expect(h2?.textContent).toContain('Book your');
    expect(h2?.textContent).toContain('table online');
    expect(h2?.querySelector('.text-brand-amber')?.textContent).toContain('table online');
    // One list item per entry in the component's features array.
    expect(el.querySelectorAll('ul > li').length).toBe(4);
    expect(el.textContent).toContain('Groups of 2 – 30 guests');
  });

  // The existing booking paragraph is kept
  it('keeps the booking paragraph', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reservations guaranteed');
  });

  // Decorative layers: the 3D canvas is a canvas, not an image, and the soju word is hidden from assistive tech
  it('renders the decorative 3D bottles and the 소주 word', async () => {
    stubScreen(true);
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    await fixture.whenStable();
    // The width is read after the first render, so render once more to mount the canvas
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-section-canvas')).toBeTruthy();
    expect(el.querySelector('img')).toBeNull();
    const word = Array.from(el.querySelectorAll('[aria-hidden="true"]')).find((n) =>
      n.textContent?.includes('소주'),
    );
    expect(word).toBeTruthy();
  });

  // Primary CTA routes to the reservations page; the call CTA is a placeholder button
  it('links "Reserve a Table" to /reservations and keeps the call CTA as a placeholder', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const reserve = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Reserve a Table'),
    );
    expect(reserve?.getAttribute('href')).toBe('/reservations');
    expect(reserve?.classList.contains('btn-primary')).toBe(true);

    // No phone wired yet, so the call CTA stays a button.
    const call = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Or call us directly'),
    );
    expect(call).toBeTruthy();
    expect(call?.classList.contains('btn-ghost')).toBe(true);
    // Marked unavailable until a number exists, but not disabled so it stays focusable
    expect(call?.getAttribute('aria-disabled')).toBe('true');
    expect(call?.disabled).toBe(false);
  });

  // No canvas until the browser knows the screen width, so SSR never renders the wrong layout
  it('starts with the screen width unknown', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    expect(fixture.componentInstance.wide()).toBeUndefined();
  });

  // Phones get the original single big bottle, aligned as before the redesign
  it('uses the single-bottle variant on phones', async () => {
    stubScreen(false);
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    await fixture.whenStable();
    // The width is read after the first render, so render once more to mount the canvas
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('app-section-canvas');
    expect(canvas?.getAttribute('variant')).toBe('bottle');
    expect(canvas?.getAttribute('align')).toBe('right');
    expect(canvas?.getAttribute('model')).toBe('modelAssets/soju/scene.gltf');
  });

  // Three bottles at different depths from md up, with the green fallback colour for when the model fails
  it('uses the three-bottle variant for its 3D object on wide screens', async () => {
    stubScreen(true);
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    await fixture.whenStable();
    // The width is read after the first render, so render once more to mount the canvas
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('app-section-canvas');
    expect(canvas?.getAttribute('variant')).toBe('bottles');
    expect(canvas?.getAttribute('color')).toBe('#2f8f4e');
  });

  // The bottles load the textured soju model on top of the built-in fallback
  it('points the bottles at the soju model', async () => {
    stubScreen(true);
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    await fixture.whenStable();
    // The width is read after the first render, so render once more to mount the canvas
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('app-section-canvas');
    expect(canvas?.getAttribute('model')).toBe('modelAssets/soju/scene.gltf');
  });

  // Tears down cleanly, including the scroll listener, even when motion never started
  it('destroys cleanly', async () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});

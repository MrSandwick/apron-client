import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeReserve } from './reserve';

describe('HomeReserve', () => {
  beforeEach(async () => {
    // Router is provided so the "Reserve a Table" routerLink resolves.
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
    // One list item per entry in the component's features array.
    expect(el.querySelectorAll('ul > li').length).toBe(4);
    expect(el.textContent).toContain('Groups of 2 – 30 guests');
  });

  it('renders the decorative 3D object alongside the copy', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // The section uses a right-aligned Three.js canvas (the unlabelled bottle), not an image.
    const canvas = el.querySelector('app-section-canvas');
    expect(canvas).toBeTruthy();
    expect(el.querySelector('img')).toBeNull();
  });

  it('links "Reserve a Table" to /reserve and keeps the call CTA as a placeholder', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    // Primary CTA navigates to the reserve route.
    const reserve = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Reserve a Table'),
    );
    expect(reserve?.getAttribute('href')).toBe('/reserve');

    // No phone wired yet, so the call CTA stays a button.
    const call = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Or call us directly'),
    );
    expect(call).toBeTruthy();
  });

  // The old knot is now the green bottle variant
  it('uses the green bottle variant for its 3D object', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('app-section-canvas');
    expect(canvas?.getAttribute('variant')).toBe('bottle');
    expect(canvas?.getAttribute('color')).toBe('#2f8f4e');
  });

  // The bottle loads the textured soju model on top of the built-in fallback
  it('points the bottle at the soju model', () => {
    const fixture = TestBed.createComponent(HomeReserve);
    fixture.detectChanges();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('app-section-canvas');
    expect(canvas?.getAttribute('model')).toBe('modelAssets/soju/scene.gltf');
  });
});

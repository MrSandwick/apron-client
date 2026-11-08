import { TestBed } from '@angular/core/testing';
import { DishArt } from './dish-art';

describe('DishArt', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DishArt] }).compileComponents();
  });

  // Without a photo it draws the requested illustration, hidden from assistive tech
  it('shows a decorative illustration by default', async () => {
    const fixture = TestBed.createComponent(DishArt);
    fixture.componentRef.setInput('kind', 'stew');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const svg = el.querySelector('svg');
    expect(svg?.getAttribute('data-kind')).toBe('stew');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('img')).toBeNull();
  });

  // Setting src swaps in the photo inside the same fixed-ratio frame
  it('swaps to a photo when src is provided, keeping the frame', async () => {
    const fixture = TestBed.createComponent(DishArt);
    fixture.componentRef.setInput('kind', 'grill');
    fixture.componentRef.setInput('src', '/images/galbi.jpg');
    fixture.componentRef.setInput('alt', 'Galbi on the grill');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const frame = el.querySelector('[data-testid="dish-art"]');
    expect(frame?.className).toContain('aspect-[4/3]');
    const img = frame?.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/images/galbi.jpg');
    expect(img?.getAttribute('alt')).toBe('Galbi on the grill');
    expect(frame?.querySelector('svg')).toBeNull();
  });

  // An alt on an illustration makes it a labelled image instead of decoration
  it('labels the illustration when alt is given', async () => {
    const fixture = TestBed.createComponent(DishArt);
    fixture.componentRef.setInput('kind', 'drink');
    fixture.componentRef.setInput('alt', 'A green bottle');
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('A green bottle');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
  });
});

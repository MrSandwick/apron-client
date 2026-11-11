import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartEmpty } from './cart-empty';

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(CartEmpty);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('CartEmpty', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartEmpty],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  // The empty message is a sub-heading, since the page owns the h1
  it('shows the empty message as an h2, not an h1', async () => {
    const el = await render();
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Your cart is empty');
  });

  // The empty state shows the sleepy mascot, hidden from assistive tech
  it('shows the sleepy mascot face as decorative', async () => {
    const face = (await render()).querySelector('app-ahjoomah-face');
    expect(face?.getAttribute('data-mood')).toBe('sleepy');
    expect(face?.getAttribute('aria-hidden')).toBe('true');
  });

  // The primary link leads to the menu
  it('links Browse the menu to /menu', async () => {
    const link = (await render()).querySelector<HTMLAnchorElement>('a');
    expect(link?.textContent?.trim()).toBe('Browse the menu');
    expect(link?.getAttribute('href')).toBe('/menu');
    expect(link?.className).toContain('btn-primary');
  });
});

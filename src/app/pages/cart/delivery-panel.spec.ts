import { TestBed } from '@angular/core/testing';
import { DELIVERY_URL } from '../../core/config/ordering.config';
import { DeliveryPanel } from './delivery-panel';

async function mount(url?: string) {
  await TestBed.configureTestingModule({
    imports: [DeliveryPanel],
    providers: url ? [{ provide: DELIVERY_URL, useValue: url }] : [],
  }).compileComponents();
  const fixture = TestBed.createComponent(DeliveryPanel);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { el, link: el.querySelector<HTMLAnchorElement>('a')! };
}

describe('DeliveryPanel', () => {
  // The copy explains why the cart is not carried over
  it('explains that Uber Eats has its own menu', async () => {
    const { el } = await mount();
    expect(el.textContent).toContain(
      'Uber Eats has its own menu, so your items here are not sent over. Your takeout cart is saved here.',
    );
  });

  // The link falls back to the configured default URL
  it('links to the default DELIVERY_URL', async () => {
    const { link } = await mount();
    expect(link.getAttribute('href')).toBe('https://www.ubereats.com/');
  });

  // An overridden provider changes the destination
  it('uses an overridden DELIVERY_URL provider', async () => {
    const { link } = await mount('https://example.test/order');
    expect(link.getAttribute('href')).toBe('https://example.test/order');
  });

  // External links open in a new tab without leaking the opener
  it('opens in a new tab with noopener noreferrer', async () => {
    const { link } = await mount();
    expect(link.target).toBe('_blank');
    const rel = link.getAttribute('rel')?.split(' ') ?? [];
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  // The visible label and the screen reader hint are both present
  it('shows the link label and an sr-only new-tab hint', async () => {
    const { link } = await mount();
    expect(link.textContent).toContain('Order delivery on Uber Eats');
    const hint = link.querySelector('.sr-only');
    expect(hint?.textContent?.trim()).toBe('(opens in a new tab)');
  });

  // The icon is decoration only
  it('hides the external-link icon from assistive tech', async () => {
    const { link } = await mount();
    expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  // The link is a comfortable touch target
  it('gives the link a min-h-11 target', async () => {
    const { link } = await mount();
    expect(link.classList.contains('min-h-11')).toBe(true);
  });
});

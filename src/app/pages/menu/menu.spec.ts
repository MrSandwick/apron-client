import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Menu } from './menu';
import { MENU } from './menu.data';
import { routes } from '../../app.routes';

describe('Menu', () => {
  let fixture: ComponentFixture<Menu>;
  let el: HTMLElement;

  beforeEach(async () => {
    // Router is provided so the chip routerLinks resolve to /menu#<id> hrefs
    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Menu);
    await fixture.whenStable();
    el = fixture.nativeElement as HTMLElement;
  });

  // Every category renders as a section, in data order, with its Korean title in the heading
  it('renders all six categories in order with their Korean titles', () => {
    const sections = Array.from(el.querySelectorAll('[data-testid="menu-category"]'));
    expect(sections.map((s) => s.id)).toEqual([
      'bbq',
      'stews',
      'rice-noodles',
      'banchan',
      'drinks',
      'desserts',
    ]);
    sections.forEach((section, i) => {
      const heading = section.querySelector('h2');
      expect(section.getAttribute('aria-labelledby')).toBe(heading?.id);
      expect(heading?.textContent).toContain(MENU[i].title);
      expect(heading?.textContent).toContain(MENU[i].kr);
    });
  });

  // One card per dish in the data file
  it('renders a card for every dish', () => {
    const total = MENU.reduce((sum, c) => sum + c.dishes.length, 0);
    expect(el.querySelectorAll('[data-testid="menu-dish"]').length).toBe(total);
  });

  // Stickers appear only on picked dishes, as readable text
  it('shows a pick sticker on each picked dish only', () => {
    const picks = MENU.flatMap((c) => c.dishes).filter((d) => d.pick).length;
    const stickers = el.querySelectorAll('[data-testid="menu-pick"]');
    expect(stickers.length).toBe(picks);
    stickers.forEach((s) => expect(s.textContent).toContain("Ahjoomah's pick"));
  });

  // Each card reserves its image slot
  it('gives every card a dish-art slot', () => {
    const cards = Array.from(el.querySelectorAll('[data-testid="menu-dish"]'));
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => expect(card.querySelector('[data-testid="dish-art"]')).toBeTruthy());
  });

  // Nav chips jump to every category section and stay on /menu (a bare #id would hit <base href="/">)
  it('links a nav chip to every category id on the menu page', () => {
    const nav = el.querySelector('[data-testid="menu-nav"]');
    const hrefs = Array.from(nav?.querySelectorAll('a') ?? []).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(MENU.map((c) => `/menu#${c.id}`));
  });

  // Guards the no-emoji rule across all rendered copy
  it('renders no emoji', () => {
    expect(el.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  // The page is reachable at /menu
  it('is registered as the menu route', () => {
    expect(routes.some((r) => r.path === 'menu')).toBe(true);
  });
});

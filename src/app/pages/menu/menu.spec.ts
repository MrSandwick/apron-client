import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { Subject, of } from 'rxjs';
import { Menu } from './menu';
import { MENU } from './menu.data';
import { MenuResult, MenuService } from './menu.service';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';

// Builds the page against a fake service that emits the given stream
async function setup(load: () => ReturnType<MenuService['load']>) {
  await TestBed.configureTestingModule({
    imports: [Menu],
    providers: [provideRouter([]), { provide: MenuService, useValue: { load } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(Menu);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('Menu', () => {
  let fixture: ComponentFixture<Menu>;
  let el: HTMLElement;

  beforeEach(async () => {
    // Router is provided so the chip routerLinks resolve to /menu#<id> hrefs
    ({ fixture, el } = await setup(() => of({ categories: MENU, source: 'api' })));
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

  // Every dish shows a Korean name, so the cards read as a Korean menu throughout
  it('shows a Korean name on every card', () => {
    const cards = Array.from(el.querySelectorAll('[data-testid="menu-dish"]'));
    cards.forEach((card) =>
      expect(card.querySelector('[lang="ko"]')?.textContent?.trim()).toBeTruthy(),
    );
    expect(MENU.flatMap((c) => c.dishes).every((d) => d.kr.length > 0)).toBe(true);
  });

  // The page renders exactly the tags and NEW markers the data declares
  it('renders the tag badges and NEW markers from the data', () => {
    const dishes = MENU.flatMap((c) => c.dishes);
    const tagCount = dishes.reduce((sum, d) => sum + (d.tags?.length ?? 0), 0);
    expect(el.querySelectorAll('[data-testid="menu-tag"]').length).toBe(tagCount);
    expect(el.querySelectorAll('[data-testid="menu-new"]').length).toBe(
      dishes.filter((d) => d.isNew).length,
    );
  });

  // No dish claims two spice levels
  it('gives each dish at most one spice level', () => {
    for (const dish of MENU.flatMap((c) => c.dishes)) {
      const spice = (dish.tags ?? []).filter((t) => t === 'mild' || t === 'spicy');
      expect(spice.length).toBeLessThanOrEqual(1);
    }
  });

  // The page is reachable at /menu
  it('is registered as the menu route', () => {
    expect(routes.some((r) => r.path === 'menu')).toBe(true);
  });

  // Menu is rendered per request, not prerendered, and matched before the catch-all
  it('declares the menu server route as Server mode before the catch-all', () => {
    const menuIdx = serverRoutes.findIndex((r) => r.path === 'menu');
    const allIdx = serverRoutes.findIndex((r) => r.path === '**');
    expect(menuIdx).toBeGreaterThanOrEqual(0);
    expect(menuIdx).toBeLessThan(allIdx);
    expect(serverRoutes[menuIdx].renderMode).toBe(RenderMode.Server);
  });

  // Live data shows neither the skeleton nor the fallback notice
  it('shows no skeleton or fallback notice for api data', () => {
    expect(el.querySelector('[data-testid="menu-loading"]')).toBeNull();
    expect(el.querySelector('[data-testid="menu-fallback"]')).toBeNull();
  });
});

describe('Menu loading and fallback', () => {
  // Skeleton shows until the service emits, then gives way to the categories
  it('shows the loading skeleton before data and removes it after', async () => {
    const subject = new Subject<MenuResult>();
    const { fixture, el } = await setup(() => subject);
    expect(el.querySelector('[data-testid="menu-loading"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(0);

    subject.next({ categories: MENU, source: 'api' });
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="menu-loading"]')).toBeNull();
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(MENU.length);
  });

  // The calm notice appears only for fallback data, and the menu still renders fully
  it('shows the fallback notice only for fallback data', async () => {
    const { el } = await setup(() => of({ categories: MENU, source: 'fallback' }));
    const notice = el.querySelector('[data-testid="menu-fallback"]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('sample menu');
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(MENU.length);
  });
});

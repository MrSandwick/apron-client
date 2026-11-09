import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { Subject, of } from 'rxjs';
import { DishCard } from './dish-card';
import { Menu } from './menu';
import { MENU, MenuCategory, MenuDish } from './menu.data';
import { MenuResult, MenuService } from './menu.service';
import { routes } from '../../app.routes';
import { serverRoutes } from '../../app.routes.server';

// Builds the page against a fake service that emits the given stream. `url` is visited first,
// so a test can open the page on a ?item= link
async function setup(load: () => ReturnType<MenuService['load']>, url?: string) {
  await TestBed.configureTestingModule({
    imports: [Menu],
    providers: [provideRouter([]), { provide: MenuService, useValue: { load } }],
  }).compileComponents();
  if (url) {
    await TestBed.inject(Router).navigateByUrl(url);
  }
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

// Two tabs, three sections: one dish with a price, one sold out
const dish = (id: string, over: Partial<MenuDish> = {}): MenuDish => ({
  id,
  name: `Dish ${id}`,
  kr: '요리',
  description: 'Tasty.',
  price: '$12',
  priceMinor: 1200,
  currency: 'USD',
  dish: 'rice',
  noteMaxLength: 200,
  optionGroups: [],
  ...over,
});
const ORDERABLE: MenuCategory[] = [
  {
    id: 'a',
    group: 'MAIN',
    title: 'A',
    kr: '',
    blurb: '',
    dishes: [dish('d1'), dish('d2', { soldOut: true })],
  },
  { id: 'b', group: 'MAIN', title: 'B', kr: '', blurb: '', dishes: [dish('d3')] },
  { id: 'c', group: 'DRINKS', title: 'C', kr: '', blurb: '', dishes: [dish('d4')] },
];
const load = () => of<MenuResult>({ categories: ORDERABLE, source: 'api' });
const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('Menu ordering', () => {
  beforeEach(() => {
    // The cart reads and writes localStorage, so give each test a private one
    const data: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Selecting a card opens the dialog for that dish and records it in the address
  it('opens the dialog and sets ?item= when a card is selected', async () => {
    const { fixture, el } = await setup(load);
    const card = fixture.debugElement.queryAll(By.directive(DishCard))[0];
    card.triggerEventHandler('select', ORDERABLE[0].dishes[0]);
    await fixture.whenStable();
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(true);
    expect(q(el, 'item-dialog')?.textContent).toContain('Dish d1');
    expect(TestBed.inject(Router).url).toContain('item=d1');
  });

  // Closing removes the parameter and shuts the dialog
  it('removes ?item= when the dialog closes', async () => {
    const { fixture, el } = await setup(load);
    // Going back one entry lands on the page without the parameter
    vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(
      () => void TestBed.inject(Router).navigateByUrl('/'),
    );
    fixture.debugElement
      .queryAll(By.directive(DishCard))[0]
      .triggerEventHandler('select', ORDERABLE[0].dishes[0]);
    await fixture.whenStable();
    q(el, 'item-dialog-close')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).not.toContain('item=');
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(false);
  });

  // Adding closes the dialog, shows the toast and the cart bar, and the toast then goes away
  it('confirms an add with a toast and a cart bar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fixture, el } = await setup(load);
    vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(
      () => void TestBed.inject(Router).navigateByUrl('/'),
    );
    expect(q(el, 'menu-cart-bar')).toBeNull();
    fixture.debugElement
      .queryAll(By.directive(DishCard))[0]
      .triggerEventHandler('select', ORDERABLE[0].dishes[0]);
    await fixture.whenStable();
    q(el, 'item-dialog-add')?.click();
    await fixture.whenStable();
    const toast = q(el, 'menu-cart-toast');
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.textContent).toContain('Added to cart');
    const bar = q(el, 'menu-cart-bar');
    expect(bar?.textContent).toContain('1 item');
    expect(bar?.textContent).toContain('$12');
    expect(bar?.querySelector('a')?.getAttribute('href')).toBe('/order');
    expect(TestBed.inject(Router).url).not.toContain('item=');

    vi.advanceTimersByTime(5000);
    await fixture.whenStable();
    // The live region stays, only its text goes
    expect(q(el, 'menu-cart-toast')?.textContent?.trim()).toBe('');
    expect(q(el, 'menu-cart-bar')).toBeTruthy();
  });

  // A shared ?item= link opens that dish once the menu is there
  it('opens the dialog for a ?item= link', async () => {
    const { el } = await setup(load, '/?item=d3');
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(true);
    expect(q(el, 'item-dialog')?.textContent).toContain('Dish d3');
  });

  // Unknown and sold-out ids open nothing
  it('ignores unknown and sold-out ?item= ids', async () => {
    for (const id of ['nope', 'd2']) {
      TestBed.resetTestingModule();
      const { el } = await setup(load, `/?item=${id}`);
      expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(false);
    }
  });

  // The tab name sits above the first section of each tab only
  it('labels each menu tab once', async () => {
    const { el } = await setup(load);
    const labels = Array.from(el.querySelectorAll('[data-testid="menu-group"]')).map((e) =>
      e.textContent?.trim(),
    );
    expect(labels).toEqual(['MAIN', 'DRINKS']);
  });

  // A dialog opened from a card closes by stepping back one history entry
  it('goes back one entry when a card-opened dialog closes', async () => {
    const { fixture, el } = await setup(load);
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    fixture.debugElement
      .queryAll(By.directive(DishCard))[0]
      .triggerEventHandler('select', ORDERABLE[0].dishes[0]);
    await fixture.whenStable();
    q(el, 'item-dialog-close')?.click();
    expect(back).toHaveBeenCalledTimes(1);
  });

  // A deep-linked dialog has no earlier entry, so closing replaces the address instead
  it('replaces the address when a deep-linked dialog closes', async () => {
    const { fixture, el } = await setup(load, '/?item=d3');
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    q(el, 'item-dialog-close')?.click();
    await fixture.whenStable();
    expect(back).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).not.toContain('item=');
  });

  // The Back button (address loses ?item=) closes the open dialog
  it('closes the dialog when the address loses ?item=', async () => {
    const { fixture, el } = await setup(load, '/?item=d3');
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    expect((q(el, 'item-dialog') as HTMLDialogElement).open).toBe(false);
  });

  // Room is kept under the page for the fixed cart bar
  it('pads the page while the cart bar shows', async () => {
    const { fixture, el } = await setup(load);
    const main = q(el, 'menu-page')!;
    expect(main.className).toContain('pb-24');
    fixture.debugElement
      .queryAll(By.directive(DishCard))[0]
      .triggerEventHandler('select', ORDERABLE[0].dishes[0]);
    await fixture.whenStable();
    q(el, 'item-dialog-add')?.click();
    await fixture.whenStable();
    expect(main.className).toContain('pb-44');
  });
});

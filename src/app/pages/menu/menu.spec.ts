import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { Subject, of } from 'rxjs';
import { DishCard } from './dish-card';
import { Menu } from './menu';
import { MENU, MenuCategory, MenuDish } from './menu.data';
import { isListCategory } from './menu.filters';
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

  // Every dish renders once: as a card, or as a row in a list category
  it('renders a card or list row for every dish', () => {
    const total = MENU.reduce((sum, c) => sum + c.dishes.length, 0);
    const cards = el.querySelectorAll('[data-testid="menu-dish"]').length;
    const rows = el.querySelectorAll('[data-testid="menu-row"]').length;
    expect(cards + rows).toBe(total);
    expect(rows).toBe(MENU.filter(isListCategory).flatMap((c) => c.dishes).length);
  });

  // Stickers appear only on picked dishes shown as cards (drink rows have no sticker)
  it('shows a pick sticker on each picked card only', () => {
    const picks = MENU.filter((c) => !isListCategory(c))
      .flatMap((c) => c.dishes)
      .filter((d) => d.pick).length;
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

  // Nav chips list the visible categories and stay on /menu (a bare #id would hit <base href="/">)
  it('links a nav chip to every visible category id on the menu page', () => {
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

  // The page renders exactly the card tags and NEW markers the data declares (drink rows have no NEW marker)
  it('renders the tag badges and NEW markers from the data', () => {
    const dishes = MENU.filter((c) => !isListCategory(c)).flatMap((c) => c.dishes);
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
    expect(bar?.querySelector('a')?.getAttribute('href')).toBe('/cart');
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

// Tagged dishes across a food category, a second food category and a drink category
const tagged = (id: string, tags: MenuDish['tags'], art: MenuDish['dish'] = 'rice'): MenuDish =>
  dish(id, { tags, dish: art });
const FILTERABLE: MenuCategory[] = [
  {
    id: 'food',
    title: 'Food',
    kr: '',
    blurb: '',
    dishes: [
      tagged('veg', ['vegetarian', 'mild']),
      tagged('hot-veg', ['spicy', 'vegetarian']),
      tagged('meat', ['mild']),
    ],
  },
  { id: 'fire', title: 'Fire', kr: '', blurb: '', dishes: [tagged('inferno', ['extra-hot'])] },
  {
    id: 'sips',
    title: 'Sips',
    kr: '',
    blurb: '',
    dishes: [tagged('tea', ['vegan'], 'drink'), tagged('soju', undefined, 'drink')],
  },
];
const loadFilterable = () => of<MenuResult>({ categories: FILTERABLE, source: 'api' });
const chip = (el: HTMLElement, label: string) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('[data-testid="menu-filter"]')).find(
    (b) => b.textContent?.trim() === label,
  )!;
const dishNames = (el: HTMLElement) =>
  Array.from(
    el.querySelectorAll('[data-testid="menu-dish"] h3, [data-testid="menu-row"] h3'),
  ).map((h) => h.textContent?.trim().split(/\s+/).slice(0, 2).join(' '));

describe('Menu filters', () => {
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
  afterEach(() => vi.unstubAllGlobals());

  // Chips start off, with no count or reset showing
  it('starts with every chip off and no count', async () => {
    const { el } = await setup(loadFilterable);
    const chips = Array.from(el.querySelectorAll('[data-testid="menu-filter"]'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'Vegetarian',
      'Vegan',
      'Gluten free',
      'Mild',
    ]);
    chips.forEach((c) => expect(c.getAttribute('aria-pressed')).toBe('false'));
    // The live region is always in the page, but empty while no filter is on
    expect(q(el, 'menu-filter-count')?.getAttribute('role')).toBe('status');
    expect(q(el, 'menu-filter-count')?.textContent?.trim()).toBe('');
    expect(q(el, 'menu-filter-clear')).toBeNull();
  });

  // Toggling a chip presses it, hides non-matching dishes and categories, and shows the count
  it('filters dishes and categories and shows a count when a chip is toggled', async () => {
    const { fixture, el } = await setup(loadFilterable);
    chip(el, 'Vegetarian').click();
    await fixture.whenStable();

    expect(chip(el, 'Vegetarian').getAttribute('aria-pressed')).toBe('true');
    expect(chip(el, 'Vegan').getAttribute('aria-pressed')).toBe('false');
    // Vegan tea counts as vegetarian; the meat dish, inferno and soju are gone
    expect(dishNames(el)).toEqual(['Dish veg', 'Dish hot-veg', 'Dish tea']);
    const sections = Array.from(el.querySelectorAll('[data-testid="menu-category"]'));
    expect(sections.map((s) => s.id)).toEqual(['food', 'sips']);
    const navIds = Array.from(el.querySelectorAll('[data-testid="menu-nav"] a')).map((a) =>
      a.getAttribute('data-nav-id'),
    );
    expect(navIds).toEqual(['food', 'sips']);
    expect(q(el, 'menu-filter-count')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '3 of 6 dishes',
    );
  });

  // Toggling the same chip again turns it off and restores everything
  it('restores the menu when the chip is toggled off again', async () => {
    const { fixture, el } = await setup(loadFilterable);
    chip(el, 'Vegetarian').click();
    await fixture.whenStable();
    chip(el, 'Vegetarian').click();
    await fixture.whenStable();
    expect(chip(el, 'Vegetarian').getAttribute('aria-pressed')).toBe('false');
    expect(dishNames(el).length).toBe(6);
    expect(q(el, 'menu-filter-count')?.textContent?.trim()).toBe('');
  });

  // Several chips must all match
  it('combines chips with AND', async () => {
    const { fixture, el } = await setup(loadFilterable);
    chip(el, 'Vegetarian').click();
    chip(el, 'Mild').click();
    await fixture.whenStable();
    // Only the vegetarian dish that is also tagged mild survives
    expect(dishNames(el)).toEqual(['Dish veg']);
    expect(q(el, 'menu-filter-count')?.textContent).toContain('1 of 6');
  });

  // Clear switches every chip off and brings the full menu back
  it('resets all filters with Clear', async () => {
    const { fixture, el } = await setup(loadFilterable);
    chip(el, 'Vegetarian').click();
    chip(el, 'Mild').click();
    await fixture.whenStable();
    q(el, 'menu-filter-clear')?.click();
    await fixture.whenStable();
    el.querySelectorAll('[data-testid="menu-filter"]').forEach((c) =>
      expect(c.getAttribute('aria-pressed')).toBe('false'),
    );
    expect(dishNames(el).length).toBe(6);
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(3);
    expect(q(el, 'menu-filter-count')?.textContent?.trim()).toBe('');
  });

  // A filter set that matches nothing shows the empty panel instead of sections
  it('shows the empty panel when no dish matches, and Clear filters recovers', async () => {
    const { fixture, el } = await setup(loadFilterable);
    chip(el, 'Vegan').click();
    chip(el, 'Gluten free').click();
    await fixture.whenStable();
    expect(q(el, 'menu-filter-empty')?.textContent).toContain('No dishes match');
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(0);
    expect(q(el, 'menu-filter-count')?.textContent).toContain('0 of 6');
    // With nothing to jump to, the category nav is removed too
    expect(q(el, 'menu-nav')).toBeNull();

    q(el, 'menu-filter-empty')?.querySelector('button')?.click();
    await fixture.whenStable();
    expect(q(el, 'menu-filter-empty')).toBeNull();
    expect(q(el, 'menu-nav')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="menu-category"]').length).toBe(3);
  });

  // The empty panel never shows while the menu is unfiltered
  it('shows no empty panel without filters', async () => {
    const { el } = await setup(loadFilterable);
    expect(q(el, 'menu-filter-empty')).toBeNull();
  });
});

// A pointer event with the fields the nav drag handlers read (jsdom has no PointerEvent)
function pointer(type: string, x: number, pointerType = 'mouse'): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    pointerType: { value: pointerType },
    button: { value: 0 },
    clientX: { value: x },
    pointerId: { value: 1 },
  });
  return e;
}

describe('Menu category nav', () => {
  // The nav scrolls by drag and swipe, so it has no arrow buttons
  it('renders no scroll arrow buttons', async () => {
    const { el } = await setup(loadFilterable);
    expect(q(el, 'menu-nav')).toBeTruthy();
    expect(q(el, 'menu-nav-left')).toBeNull();
    expect(q(el, 'menu-nav-right')).toBeNull();
  });

  // A real mouse drag swallows the click that ends it, so the pill does not navigate
  it('does not follow a pill after a mouse drag, but follows a plain click', async () => {
    const { el } = await setup(loadFilterable);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const list = el.querySelector<HTMLElement>('[data-testid="menu-nav"] ul')!;
    const pill = list.querySelector<HTMLAnchorElement>('[data-nav-id="food"]')!;

    // Press, move well past the 5px threshold, release, then the click the browser fires
    pill.dispatchEvent(pointer('pointerdown', 100));
    list.dispatchEvent(pointer('pointermove', 60));
    list.dispatchEvent(pointer('pointerup', 60));
    pill.click();
    expect(navigate).not.toHaveBeenCalled();

    // A plain click afterwards navigates to the category fragment
    pill.click();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toBe('/menu#food');
  });

  // Movement under the threshold is a click, not a drag
  it('still follows a pill when the mouse moves less than the drag threshold', async () => {
    const { el } = await setup(loadFilterable);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const list = el.querySelector<HTMLElement>('[data-testid="menu-nav"] ul')!;
    const pill = list.querySelector<HTMLAnchorElement>('[data-nav-id="food"]')!;
    pill.dispatchEvent(pointer('pointerdown', 100));
    list.dispatchEvent(pointer('pointermove', 98));
    list.dispatchEvent(pointer('pointerup', 98));
    pill.click();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('Menu drink categories', () => {
  // Drink categories render priced rows inside a list, not dish cards; food keeps its cards
  it('renders drink rows in a list instead of dish cards', async () => {
    const { el } = await setup(loadFilterable);
    const sips = el.querySelector('#sips')!;
    expect(sips.querySelectorAll('[data-testid="menu-dish"]').length).toBe(0);
    const rows = sips.querySelectorAll('ul [data-testid="menu-row"]');
    expect(rows.length).toBe(2);
    rows.forEach((row) => expect(row.closest('li')).toBeTruthy());

    const food = el.querySelector('#food')!;
    expect(food.querySelectorAll('[data-testid="menu-dish"]').length).toBe(3);
    expect(food.querySelectorAll('[data-testid="menu-row"]').length).toBe(0);
  });

  // The off-menu category is a list too, although its dishes are food art
  it('renders an off-menu category as list rows instead of dish cards', async () => {
    const offMenu: MenuCategory = {
      id: 'off-menu',
      title: 'Off Menu',
      kr: '',
      blurb: '',
      dishes: [dish('o1'), dish('o2')],
    };
    const { el } = await setup(() => of<MenuResult>({ categories: [offMenu], source: 'api' }));
    const section = el.querySelector('#off-menu')!;
    expect(section.querySelectorAll('ul [data-testid="menu-row"]').length).toBe(2);
    expect(section.querySelectorAll('[data-testid="menu-dish"]').length).toBe(0);
  });

  // Choosing a drink row opens the item dialog like a card does
  it('opens the dialog when a drink row is selected', async () => {
    const { fixture, el } = await setup(loadFilterable);
    el.querySelector<HTMLButtonElement>('#sips [data-testid="menu-order"]')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('item=tea');
  });
});

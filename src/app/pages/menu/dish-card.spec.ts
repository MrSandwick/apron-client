import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DishCard } from './dish-card';
import { MenuDish } from './menu.data';

// A bare dish, extended per test
const base: MenuDish = {
  id: 'test-1',
  name: 'Test dish',
  kr: '시험',
  description: 'Test description.',
  price: '$00',
  dish: 'grill',
};

async function render(dish: MenuDish): Promise<HTMLElement> {
  const fixture: ComponentFixture<DishCard> = TestBed.createComponent(DishCard);
  fixture.componentRef.setInput('dish', dish);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('DishCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DishCard] }).compileComponents();
  });

  // A dish with no tags renders no badge list at all, so there is nothing to shift or announce
  it('renders no tag list when the dish has no tags', async () => {
    const el = await render(base);
    expect(el.querySelector('[aria-label="Dish tags"]')).toBeNull();
    expect(el.querySelectorAll('[data-testid="menu-tag"]').length).toBe(0);
  });

  // Each tag shows as a badge with its own words, not just a colour
  it('shows a text badge for every tag', async () => {
    const el = await render({ ...base, tags: ['vegetarian', 'mild'] });
    const labels = Array.from(el.querySelectorAll('[data-testid="menu-tag"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(labels).toEqual(['Mild', 'Vegetarian']);
  });

  // Badges keep one fixed order whatever order the data lists them in
  it('orders badges consistently: spice first, then vegetarian', async () => {
    const a = await render({ ...base, tags: ['vegetarian', 'spicy'] });
    const b = await render({ ...base, tags: ['spicy', 'vegetarian'] });
    const text = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('[data-testid="menu-tag"]')).map((t) => t.textContent?.trim());
    expect(text(a)).toEqual(['Spicy', 'Vegetarian']);
    expect(text(b)).toEqual(text(a));
  });

  // The NEW marker appears only on new dishes and is real text
  it('shows the NEW marker only when the dish is new', async () => {
    const plain = await render(base);
    expect(plain.querySelector('[data-testid="menu-new"]')).toBeNull();

    const fresh = await render({ ...base, isNew: true });
    expect(fresh.querySelector('[data-testid="menu-new"]')?.textContent?.trim()).toBe('New');
  });

  // NEW and the pick sticker can sit on the same card without replacing each other
  it('shows both the NEW marker and the pick sticker together', async () => {
    const el = await render({ ...base, isNew: true, pick: true });
    expect(el.querySelector('[data-testid="menu-new"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="menu-pick"]')).toBeTruthy();
  });

  // The Korean name is always visible
  it('always shows the Korean name', async () => {
    const el = await render(base);
    expect(el.querySelector('[lang="ko"]')?.textContent?.trim()).toBe('시험');
  });

  // The price stays pinned to the bottom so prices line up across a row, with or without tags
  it('keeps the price pinned to the card bottom', async () => {
    for (const dish of [base, { ...base, tags: ['spicy' as const] }]) {
      const el = await render(dish);
      const price = Array.from(el.querySelectorAll('p')).find(
        (p) => p.textContent?.trim() === '$00',
      );
      expect(price?.parentElement?.className).toContain('mt-auto');
    }
  });

  // The sold-out label shows only on sold-out dishes and keeps the price visible
  it('shows a Sold out label only when the dish is sold out', async () => {
    const plain = await render(base);
    expect(plain.querySelector('[data-testid="menu-sold-out"]')).toBeNull();

    const gone = await render({ ...base, soldOut: true });
    expect(gone.querySelector('[data-testid="menu-sold-out"]')?.textContent?.trim()).toBe(
      'Sold out',
    );
    expect(gone.textContent).toContain('$00');
  });

  // Sold out sits beside NEW and the pick sticker rather than replacing them
  it('keeps NEW and pick markers on a sold-out dish', async () => {
    const el = await render({ ...base, soldOut: true, isNew: true, pick: true });
    expect(el.querySelector('[data-testid="menu-sold-out"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="menu-new"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="menu-pick"]')).toBeTruthy();
  });

  // The code sits inside the heading so screen readers read it with the name
  it('shows the dish code in the heading when present', async () => {
    const el = await render({ ...base, code: 'A1' });
    expect(el.querySelector('h3')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('A1 Test dish');
    const plain = await render(base);
    expect(plain.querySelector('[data-testid="menu-code"]')).toBeNull();
  });

  // Featured is a text badge shown only on featured dishes
  it('shows the Featured badge only when featured', async () => {
    const plain = await render(base);
    expect(plain.querySelector('[data-testid="menu-featured"]')).toBeNull();
    const el = await render({ ...base, featured: true });
    expect(el.querySelector('[data-testid="menu-featured"]')?.textContent?.trim()).toBe('Featured');
  });

  // The label tells guests whether choices follow
  it('labels the order button by whether the dish has options', async () => {
    const plain = await render(base);
    expect(plain.querySelector('[data-testid="menu-order"]')?.textContent?.trim()).toBe(
      'Add to order',
    );
    const group = { id: 'g', name: 'Cut', kr: '', required: false, min: 0, max: 1, choices: [] };
    const custom = await render({ ...base, optionGroups: [group] });
    expect(custom.querySelector('[data-testid="menu-order"]')?.textContent?.trim()).toBe(
      'Customize',
    );
  });

  // Clicking the button emits the card's own dish
  it('emits select with the dish when the order button is clicked', async () => {
    const fixture = TestBed.createComponent(DishCard);
    const dish = { ...base, id: 'picked' };
    fixture.componentRef.setInput('dish', dish);
    await fixture.whenStable();
    const emitted: MenuDish[] = [];
    fixture.componentInstance.select.subscribe((d) => emitted.push(d));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="menu-order"]')
      ?.click();
    expect(emitted).toEqual([dish]);
  });

  // A sold-out dish cannot be ordered, so no button is offered
  it('offers no order button on a sold-out dish', async () => {
    const el = await render({ ...base, soldOut: true });
    expect(el.querySelector('[data-testid="menu-order"]')).toBeNull();
  });

  // All seven tags show their names in the fixed order whatever the input order
  it('renders all seven tags in the fixed order', async () => {
    const el = await render({
      ...base,
      tags: ['organic', 'gluten-free', 'vegan', 'vegetarian', 'mild', 'spicy', 'extra-hot'],
    });
    const labels = Array.from(el.querySelectorAll('[data-testid="menu-tag"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Extra hot',
      'Spicy',
      'Mild',
      'Vegetarian',
      'Vegan',
      'Gluten free',
      'Organic',
    ]);
  });
});

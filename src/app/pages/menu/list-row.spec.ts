import { TestBed } from '@angular/core/testing';
import { ListRow } from './list-row';
import { MenuDish } from './menu.data';

// A bare drink, extended per test
const base: MenuDish = {
  id: 'drink-1',
  name: 'Barley tea',
  kr: '보리차',
  description: 'Roasted and served cold.',
  price: '$4',
  dish: 'drink',
};

async function mount(dish: MenuDish) {
  const fixture = TestBed.createComponent(ListRow);
  fixture.componentRef.setInput('dish', dish);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ListRow', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListRow] }).compileComponents();
  });

  // The row shows the name, the Korean name and the price
  it('renders the name, Korean name and price', async () => {
    const { el } = await mount(base);
    const heading = el.querySelector('h3');
    expect(heading?.textContent).toContain('Barley tea');
    expect(heading?.querySelector('[lang="ko"]')?.textContent?.trim()).toBe('보리차');
    expect(el.textContent).toContain('$4');
  });

  // No Korean name means no empty Korean span
  it('omits the Korean name when there is none', async () => {
    const { el } = await mount({ ...base, kr: '' });
    expect(el.querySelector('[lang="ko"]')).toBeNull();
  });

  // A plain drink is a quick add and the label carries the name
  it('labels the button "Add <name>" for a plain drink', async () => {
    const { el } = await mount(base);
    expect(el.querySelector('[data-testid="menu-order"]')?.getAttribute('aria-label')).toBe(
      'Add Barley tea',
    );
  });

  // A drink with choices reads as customizable
  it('labels the button "Customize <name>" for a drink with options', async () => {
    const group = { id: 'g', name: 'Size', kr: '', required: true, min: 1, max: 1, choices: [] };
    const { el } = await mount({ ...base, optionGroups: [group] });
    expect(el.querySelector('[data-testid="menu-order"]')?.getAttribute('aria-label')).toBe(
      'Customize Barley tea',
    );
  });

  // Clicking the button hands the row's dish to the page
  it('emits select with the dish when the button is clicked', async () => {
    const { fixture, el } = await mount(base);
    const emitted: MenuDish[] = [];
    fixture.componentInstance.select.subscribe((d) => emitted.push(d));
    el.querySelector<HTMLButtonElement>('[data-testid="menu-order"]')?.click();
    expect(emitted).toEqual([base]);
  });

  // The button stretches over the row so the whole row is tappable
  it('gives the button a stretched hit area', async () => {
    const { el } = await mount(base);
    expect(el.querySelector('[data-testid="menu-order"]')?.className).toContain('after:inset-0');
  });

  // A sold-out drink says so and cannot be ordered
  it('shows Sold out and no button when sold out', async () => {
    const { el } = await mount({ ...base, soldOut: true });
    expect(el.querySelector('[data-testid="menu-sold-out"]')?.textContent?.trim()).toBe(
      'Sold out',
    );
    expect(el.querySelector('[data-testid="menu-order"]')).toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  // Tags read as one quiet line of words, only when the drink has tags
  it('shows tags as plain words only when present', async () => {
    const plain = await mount(base);
    expect(plain.el.querySelector('[data-testid="menu-tag"]')).toBeNull();
    const tagged = await mount({ ...base, tags: ['vegan', 'organic'] });
    expect(tagged.el.querySelector('[data-testid="menu-tag"]')?.textContent?.trim()).toBe(
      'Vegan · Organic',
    );
  });
});

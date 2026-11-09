import { DishTag, MenuCategory, MenuDish } from './menu.data';
import { MenuFilter, filterMenu, isListCategory } from './menu.filters';

// A dish with the given tags and art
const dish = (id: string, tags?: DishTag[], art: MenuDish['dish'] = 'rice'): MenuDish => ({
  id,
  name: id,
  kr: '',
  description: '',
  price: '$10',
  dish: art,
  tags,
});
const cat = (id: string, dishes: MenuDish[]): MenuCategory => ({
  id,
  title: id,
  kr: '',
  blurb: '',
  dishes,
});
const on = (...f: MenuFilter[]) => new Set<MenuFilter>(f);
const ids = (cats: MenuCategory[]) => cats.flatMap((c) => c.dishes.map((d) => d.id));

const MENU_UNDER_TEST = [
  cat('mains', [
    dish('veg', ['vegetarian']),
    dish('vegan', ['vegan']),
    dish('hot', ['spicy', 'vegetarian']),
    dish('inferno', ['extra-hot']),
    dish('plain'),
  ]),
  cat('meat', [dish('beef', ['spicy']), dish('gf', ['gluten-free', 'mild'])]),
];

describe('filterMenu', () => {
  // No active filter means the same list back, untouched
  it('returns the input unchanged when no filters are on', () => {
    expect(filterMenu(MENU_UNDER_TEST, on())).toBe(MENU_UNDER_TEST);
  });

  // Vegan dishes are vegetarian too
  it('lets vegan dishes through the vegetarian filter', () => {
    expect(ids(filterMenu(MENU_UNDER_TEST, on('vegetarian')))).toEqual(['veg', 'vegan', 'hot']);
  });

  // Vegetarian dishes are not necessarily vegan
  it('keeps only vegan dishes for the vegan filter', () => {
    expect(ids(filterMenu(MENU_UNDER_TEST, on('vegan')))).toEqual(['vegan']);
  });

  // Gluten free matches its own tag only
  it('keeps only gluten-free dishes for the gluten-free filter', () => {
    expect(ids(filterMenu(MENU_UNDER_TEST, on('gluten-free')))).toEqual(['gf']);
  });

  // Mild needs the explicit mild tag: spicy, extra-hot and untagged dishes are all excluded
  it('keeps only dishes tagged mild for the mild filter', () => {
    expect(ids(filterMenu(MENU_UNDER_TEST, on('mild')))).toEqual(['gf']);
  });

  // Several filters must all match
  it('combines multiple filters with AND', () => {
    expect(ids(filterMenu(MENU_UNDER_TEST, on('vegetarian', 'gluten-free')))).toEqual([]);
    expect(ids(filterMenu(MENU_UNDER_TEST, on('gluten-free', 'mild')))).toEqual(['gf']);
    expect(ids(filterMenu(MENU_UNDER_TEST, on('vegan', 'gluten-free')))).toEqual([]);
  });

  // A category with nothing left disappears rather than rendering an empty heading
  it('drops categories left with no dishes', () => {
    const result = filterMenu(MENU_UNDER_TEST, on('gluten-free'));
    expect(result.map((c) => c.id)).toEqual(['meat']);
    expect(filterMenu(MENU_UNDER_TEST, on('vegan', 'gluten-free'))).toEqual([]);
  });

  // Filtering never mutates the source categories
  it('does not mutate the input categories', () => {
    filterMenu(MENU_UNDER_TEST, on('vegan'));
    expect(MENU_UNDER_TEST[0].dishes.length).toBe(5);
  });
});

describe('isListCategory', () => {
  // Every dish drawn as a drink makes a drink list
  it('is true when every dish is drink art', () => {
    expect(isListCategory(cat('d', [dish('a', [], 'drink'), dish('b', [], 'drink')]))).toBe(true);
  });

  // One non-drink dish keeps the category as cards
  it('is false when any dish is not a drink', () => {
    expect(isListCategory(cat('d', [dish('a', [], 'drink'), dish('b')]))).toBe(false);
  });

  // An empty category is not a drink list
  it('is false for an empty category', () => {
    expect(isListCategory(cat('d', []))).toBe(false);
  });

  // The off-menu category is listed by id even though its dishes are not drawn as drinks
  it('is true for the off-menu category with non-drink art', () => {
    expect(isListCategory(cat('off-menu', [dish('a'), dish('b', [], 'grill')]))).toBe(true);
  });

  // Other ids with the same food art still render as cards
  it('is false for a food category whose id is not listed', () => {
    expect(isListCategory(cat('mains', [dish('a'), dish('b', [], 'grill')]))).toBe(false);
  });
});

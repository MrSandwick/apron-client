import { MenuCategory, MenuDish } from './menu.data';

// Dietary and heat filters a guest can toggle on the menu. Several on at once must all match
export type MenuFilter = 'vegetarian' | 'vegan' | 'gluten-free' | 'mild';

// Chip order and wording
export const MENU_FILTERS: readonly { id: MenuFilter; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten free' },
  { id: 'mild', label: 'Mild' },
];

// Whether one dish passes one filter. Vegan dishes count as vegetarian too, and Mild needs the
// explicit 'mild' tag because an untagged dish has unknown heat
function passes(dish: MenuDish, filter: MenuFilter): boolean {
  const tags = dish.tags ?? [];
  switch (filter) {
    case 'vegetarian':
      return tags.includes('vegetarian') || tags.includes('vegan');
    case 'vegan':
      return tags.includes('vegan');
    case 'gluten-free':
      return tags.includes('gluten-free');
    case 'mild':
      return tags.includes('mild');
  }
}

// The categories with only matching dishes left; categories left empty are dropped
export function filterMenu(
  categories: MenuCategory[],
  active: ReadonlySet<MenuFilter>,
): MenuCategory[] {
  if (active.size === 0) {
    return categories;
  }
  return categories
    .map((c) => ({
      ...c,
      dishes: c.dishes.filter((d) => [...active].every((f) => passes(d, f))),
    }))
    .filter((c) => c.dishes.length > 0);
}

// Categories shown as a list although their dishes are not drawn as drinks, by id; a stopgap
// until the API carries a layout field per category. Each entry is the category id from the
// API/admin (confirmed live as 'off-menu')
const LIST_CATEGORY_IDS: readonly string[] = ['off-menu'];

// List sections (all drinks, or listed above) render as a priced list instead of cards
export function isListCategory(category: MenuCategory): boolean {
  return (
    LIST_CATEGORY_IDS.includes(category.id) ||
    (category.dishes.length > 0 && category.dishes.every((d) => d.dish === 'drink'))
  );
}

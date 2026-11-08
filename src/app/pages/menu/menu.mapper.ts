import { CategoryDto, DishDto, MenuDto } from '../../shared/api/menu.dto';
import { MenuCategory, MenuDish } from './menu.data';

// Shown while a US dollar dish has no real price yet; deliberate until real prices exist
const NO_PRICE = '$00';

// Formats integer minor units as a currency string: whole amounts without cents. Uses the
// currency's own number of decimals (2 for USD, 0 for JPY and KRW), and never throws: one dish
// with a bad currency code must not send the whole menu to the fallback.
export function formatPrice(minor: number, currency: string): string {
  if (minor === 0 && currency === 'USD') {
    return NO_PRICE;
  }
  try {
    const decimals =
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    const whole = minor % 10 ** decimals === 0;
    const digits = whole ? 0 : decimals;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(minor / 10 ** decimals);
  } catch {
    // Not a valid ISO 4217 code: show the plain amount with the code instead
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

// One API dish to the card view model
function toMenuDish(dto: DishDto): MenuDish {
  return {
    id: dto.id,
    name: dto.name,
    // The card only shows the Korean name when it is non-empty
    kr: dto.nameKr ?? '',
    description: dto.description,
    price: formatPrice(dto.priceMinor, dto.currency),
    dish: dto.art,
    pick: dto.pick,
    tags: dto.tags,
    isNew: dto.isNew,
    soldOut: dto.soldOut,
    src: dto.image?.url,
  };
}

function toMenuCategory(dto: CategoryDto): MenuCategory {
  return {
    id: dto.id,
    title: dto.title,
    kr: dto.titleKr ?? '',
    blurb: dto.blurb,
    dishes: dto.dishes.map(toMenuDish),
  };
}

// API menu response to the view models the page renders, keeping the API order
export function toMenuCategories(dto: MenuDto): MenuCategory[] {
  return dto.categories.map(toMenuCategory);
}

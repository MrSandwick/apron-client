import {
  CategoryDto,
  DishDto,
  MenuDto,
  OptionChoiceDto,
  OptionGroupDto,
} from '../../shared/api/menu.dto';
import { MenuCategory, MenuDish, MenuOptionChoice, MenuOptionGroup } from './menu.data';

// Shown while a US dollar dish has no real price yet; deliberate until real prices exist
const NO_PRICE = '$00';

// Formats integer minor units as a currency string: whole amounts without cents. Uses the
// currency's own number of decimals (2 for USD, 0 for JPY and KRW), and never throws: one dish
// with a bad currency code must not send the whole menu to the fallback.
export function formatPrice(minor: number, currency: string): string {
  if (minor === 0 && currency === 'USD') {
    return NO_PRICE;
  }
  return formatAmount(minor, currency);
}

// Surcharge text for an option choice: empty when included, otherwise "+" and the price. Never
// the "$00" placeholder, since a zero surcharge simply shows nothing
export function formatExtra(minor: number, currency: string): string {
  return minor > 0 ? `+${formatAmount(minor, currency)}` : '';
}

// Surcharge text as the ordering dialog shows it: always "+ " and the full amount with the
// currency's own decimals, free choices included ("+ $0.00", "+ $2.00", "+ $2.50")
export function formatExtraLabel(minor: number, currency: string): string {
  try {
    const decimals =
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    return `+ ${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Math.max(0, minor) / 10 ** decimals)}`;
  } catch {
    // Not a valid ISO 4217 code: plain amount with the code
    return `+ ${(Math.max(0, minor) / 100).toFixed(2)} ${currency}`;
  }
}

// The currency-aware amount formatting shared by prices and surcharges
function formatAmount(minor: number, currency: string): string {
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

// One API option choice to its view model
function toMenuChoice(dto: OptionChoiceDto, currency: string): MenuOptionChoice {
  return {
    id: dto.id,
    name: dto.name,
    kr: dto.nameKr ?? '',
    extraMinor: dto.extraMinor,
    extra: formatExtra(dto.extraMinor, currency),
    preSelected: dto.preSelected,
    soldOut: dto.soldOut,
  };
}

function toMenuOptionGroup(dto: OptionGroupDto, currency: string): MenuOptionGroup {
  return {
    id: dto.id,
    name: dto.name,
    kr: dto.nameKr ?? '',
    required: dto.required,
    min: dto.min,
    max: dto.max,
    choices: dto.choices.map((c) => toMenuChoice(c, currency)),
  };
}

// One API dish to the card view model
function toMenuDish(dto: DishDto): MenuDish {
  return {
    id: dto.id,
    code: dto.code ?? undefined,
    name: dto.name,
    // The card only shows the Korean name when it is non-empty
    kr: dto.nameKr ?? '',
    description: dto.description,
    price: formatPrice(dto.priceMinor, dto.currency),
    priceMinor: dto.priceMinor,
    currency: dto.currency,
    dish: dto.art,
    pick: dto.pick,
    tags: dto.tags,
    isNew: dto.isNew,
    featured: dto.featured,
    soldOut: dto.soldOut,
    optionGroups: dto.optionGroups.map((g) => toMenuOptionGroup(g, dto.currency)),
    noteMaxLength: dto.noteMaxLength,
    src: dto.image?.url,
  };
}

// Short words kept lower case inside a title, and initialisms kept upper case
const MINOR_WORDS = new Set(['a', 'an', 'and', 'for', 'of', 'or', 'the', 'to', 'with']);
const INITIALISMS = new Set(['BBQ', 'OB']);

// Admin titles mix cases ("SOUP", "Hot Pot: DINNER FOR 2"); words typed in all caps become Title
// Case so the nav and headings read as one set. Mixed-case words are left as typed
export function tidyTitle(title: string): string {
  return title.replace(/[\p{L}’']+/gu, (word, offset: number) => {
    if (word !== word.toUpperCase() || INITIALISMS.has(word)) {
      return word;
    }
    const lower = word.toLowerCase();
    if (offset > 0 && MINOR_WORDS.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function toMenuCategory(dto: CategoryDto): MenuCategory {
  return {
    id: dto.id,
    group: dto.group ?? undefined,
    title: tidyTitle(dto.title),
    kr: dto.titleKr ?? '',
    blurb: dto.blurb,
    dishes: dto.dishes.map(toMenuDish),
  };
}

// API menu response to the view models the page renders, keeping the API order
export function toMenuCategories(dto: MenuDto): MenuCategory[] {
  return dto.categories.map(toMenuCategory);
}

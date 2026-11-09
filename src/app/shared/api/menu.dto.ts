// Public menu API contract (v1). The Django API in server/ is the source of truth; these types
// describe what it returns. No Angular imports, so any code can use the file.

// Illustration shown in a dish's image slot until it has a real photo
export type DishArtKind =
  | 'grill'
  | 'meat'
  | 'stew'
  | 'rice'
  | 'noodles'
  | 'banchan'
  | 'drink'
  | 'dessert';

// Heat and dietary tags. A dish has at most one heat level (mild, spicy or extra-hot) and any
// mix of the dietary tags. Every tag is shown with its text name, never as an icon alone
export type DishTag =
  | 'mild'
  | 'spicy'
  | 'extra-hot'
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'organic';

// Longest note a guest may add to an item ("Special request"); the same limit the API enforces
export const NOTE_MAX_LENGTH_DEFAULT = 200;

// A real photo of a dish, 4:3
export interface DishImageDto {
  // Absolute path or URL of the image
  url: string;
  width: number;
  height: number;
  // null means decorative
  alt: string | null;
}

// One choice inside an option group, for example "Beef" or "Extra rice"
export interface OptionChoiceDto {
  id: string;
  name: string;
  nameKr: string | null;
  // Surcharge in minor units added to the dish price; 0 means included
  extraMinor: number;
  // Ticked when the item opens
  preSelected: boolean;
  soldOut: boolean;
}

// A set of choices on a dish. Required groups need at least `min` picks (always 1 or more);
// optional groups have min 0. `max` is the most a guest can pick; max 1 means pick one
export interface OptionGroupDto {
  id: string;
  name: string;
  nameKr: string | null;
  required: boolean;
  min: number;
  max: number;
  // Already sorted
  choices: OptionChoiceDto[];
}

export interface DishDto {
  id: string;
  // Short menu code shown before the name, for example "A1"; null when the dish has none
  code: string | null;
  name: string;
  nameKr: string | null;
  description: string;
  // Integer in minor units, for example 1850 means 18.50
  priceMinor: number;
  // ISO 4217 code, for example USD
  currency: string;
  // Illustration used while image is null
  art: DishArtKind;
  image: DishImageDto | null;
  pick: boolean;
  isNew: boolean;
  // Highlighted by the restaurant (a flag, separate from the pick sticker)
  featured: boolean;
  soldOut: boolean;
  // Already sorted: heat first, then dietary
  tags: DishTag[];
  // Already sorted; empty when the dish has no options
  optionGroups: OptionGroupDto[];
  // Most characters a guest can type in the note box for this dish
  noteMaxLength: number;
}

export interface CategoryDto {
  // Slug, also the /menu#<id> anchor
  id: string;
  // The menu tab this section sits under, for example "MAIN" or "LIQUOR PICK UP"; null when the
  // menu has no tabs
  group: string | null;
  title: string;
  titleKr: string | null;
  blurb: string;
  // Already sorted
  dishes: DishDto[];
}

export interface MenuDto {
  // Changes whenever the menu changes; matches the ETag
  version: string;
  currency: string;
  // Already sorted
  categories: CategoryDto[];
}

// Error body, RFC 9457 application/problem+json
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { field: string; message: string }[];
  requestId?: string;
}

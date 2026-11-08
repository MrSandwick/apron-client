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

// Dietary and spice tags. A dish has at most one spice level (mild or spicy)
export type DishTag = 'vegetarian' | 'mild' | 'spicy';

// A real photo of a dish, 4:3
export interface DishImageDto {
  // Absolute path or URL of the image
  url: string;
  width: number;
  height: number;
  // null means decorative
  alt: string | null;
}

export interface DishDto {
  id: string;
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
  soldOut: boolean;
  tags: DishTag[];
}

export interface CategoryDto {
  // Slug, also the /menu#<id> anchor
  id: string;
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

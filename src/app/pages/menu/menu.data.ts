import { DishTag } from '../../shared/api/menu.dto';
import { DishKind } from '../../shared/dish-art/dish-art';

export type { DishTag };

// Placeholder menu: every name, description, price and tag below is filler so the layout can
// be built and reviewed. Real dishes and prices are out of scope this round.

// Order tags are shown in on a card, so the same tag always sits in the same place: heat first,
// then dietary
export const DISH_TAG_ORDER: readonly DishTag[] = [
  'extra-hot',
  'spicy',
  'mild',
  'vegetarian',
  'vegan',
  'gluten-free',
  'organic',
];

// Visible text for each tag: badges always carry words, never colour alone
export const DISH_TAG_LABELS: Record<DishTag, string> = {
  'extra-hot': 'Extra hot',
  spicy: 'Spicy',
  mild: 'Mild',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free': 'Gluten free',
  organic: 'Organic',
};

// One choice inside an option group on a dish
export interface MenuOptionChoice {
  id: string;
  name: string;
  // Korean name, empty when there is none
  kr: string;
  // Surcharge in minor units (0 means included) and its display text, for example "+$2"; the text
  // is empty when the choice is included
  extraMinor: number;
  extra: string;
  // Ticked when the item opens
  preSelected: boolean;
  soldOut: boolean;
}

// A set of choices on a dish. required means at least `min` picks (min is 1 or more); `max` is
// the most a guest can pick, and max 1 means pick one
export interface MenuOptionGroup {
  id: string;
  name: string;
  kr: string;
  required: boolean;
  min: number;
  max: number;
  choices: MenuOptionChoice[];
}

// One dish card
export interface MenuDish {
  id: string;
  // Short menu code shown before the name, for example "A1"
  code?: string;
  name: string;
  // Korean name, shown on every card
  kr: string;
  description: string;
  price: string;
  // Base price in minor units and its currency, for working out an order total
  priceMinor?: number;
  currency?: string;
  // Illustration shown in the image slot until a photo exists
  dish: DishKind;
  // Shows the "Ahjoomah's pick" sticker
  pick?: boolean;
  // Dietary and spice badges
  tags?: DishTag[];
  // Shows the NEW marker
  isNew?: boolean;
  // Highlighted by the restaurant
  featured?: boolean;
  // Greyed out with a "Sold out" label
  soldOut?: boolean;
  // Choices a guest makes before ordering; empty or missing when the dish has none
  optionGroups?: MenuOptionGroup[];
  // Most characters allowed in the note box; 0 means the dish takes no notes
  noteMaxLength?: number;
  // Real photo, once one exists
  src?: string;
}

// One menu section with its heading copy and dishes
export interface MenuCategory {
  id: string;
  // The menu tab this section sits under, for example "MAIN"
  group?: string;
  title: string;
  kr: string;
  blurb: string;
  dishes: MenuDish[];
}

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.';
const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing.';
// Stand-in Korean name ("dish") for placeholder dishes that have no real name yet
const KR_PLACEHOLDER = '요리';

export const MENU: MenuCategory[] = [
  {
    id: 'bbq',
    title: 'BBQ',
    kr: '고기구이',
    blurb: 'Lorem ipsum dolor sit amet, grilled at your table.',
    dishes: [
      {
        id: 'bbq-1',
        name: 'Lorem galbi',
        kr: '갈비',
        description: LOREM,
        price: '$00',
        dish: 'grill',
        pick: true,
        tags: ['mild'],
      },
      {
        id: 'bbq-2',
        name: 'Ipsum samgyeopsal',
        kr: '삼겹살',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'meat',
        tags: ['mild'],
      },
      {
        id: 'bbq-3',
        name: 'Dolor bulgogi',
        kr: '불고기',
        description: LOREM,
        price: '$00',
        dish: 'meat',
        pick: true,
        tags: ['mild'],
      },
      {
        id: 'bbq-4',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM_SHORT,
        price: '$00',
        dish: 'grill',
        tags: ['spicy'],
        isNew: true,
      },
    ],
  },
  {
    id: 'stews',
    title: 'Stews',
    kr: '찌개',
    blurb: 'Lorem ipsum dolor sit amet, bubbling in stone pots.',
    dishes: [
      {
        id: 'stews-1',
        name: 'Lorem jjigae',
        kr: '김치찌개',
        description: LOREM,
        price: '$00',
        dish: 'stew',
        pick: true,
        tags: ['spicy'],
      },
      {
        id: 'stews-2',
        name: 'Ipsum stew',
        kr: '된장찌개',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'stew',
        tags: ['mild', 'vegetarian'],
      },
      {
        id: 'stews-3',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM,
        price: '$00',
        dish: 'stew',
        tags: ['spicy'],
      },
    ],
  },
  {
    id: 'rice-noodles',
    title: 'Rice & noodles',
    kr: '밥과 면',
    blurb: 'Lorem ipsum dolor sit amet, the bowls that finish a meal.',
    dishes: [
      {
        id: 'rice-noodles-1',
        name: 'Lorem bibimbap',
        kr: '비빔밥',
        description: LOREM,
        price: '$00',
        dish: 'rice',
        pick: true,
        tags: ['mild', 'vegetarian'],
      },
      {
        id: 'rice-noodles-2',
        name: 'Ipsum naengmyeon',
        kr: '냉면',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'noodles',
        tags: ['mild'],
      },
      {
        id: 'rice-noodles-3',
        name: 'Dolor fried rice',
        kr: '볶음밥',
        description: LOREM,
        price: '$00',
        dish: 'rice',
      },
      {
        id: 'rice-noodles-4',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM_SHORT,
        price: '$00',
        dish: 'noodles',
        tags: ['spicy', 'vegetarian'],
        isNew: true,
      },
    ],
  },
  {
    id: 'banchan',
    title: 'Banchan',
    kr: '반찬',
    blurb: 'Lorem ipsum dolor sit amet, small plates for the table.',
    dishes: [
      {
        id: 'banchan-1',
        name: 'Lorem kimchi',
        kr: '김치',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'banchan',
        pick: true,
        tags: ['spicy', 'vegetarian'],
      },
      {
        id: 'banchan-2',
        name: 'Ipsum namul',
        kr: '나물',
        description: LOREM,
        price: '$00',
        dish: 'banchan',
        tags: ['mild', 'vegetarian'],
      },
      {
        id: 'banchan-3',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM_SHORT,
        price: '$00',
        dish: 'banchan',
        tags: ['vegetarian'],
      },
    ],
  },
  {
    id: 'drinks',
    title: 'Drinks',
    kr: '음료',
    blurb: 'Lorem ipsum dolor sit amet, something cold for the grill.',
    dishes: [
      {
        id: 'drinks-1',
        name: 'Lorem soju',
        kr: '소주',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'drink',
        pick: true,
      },
      {
        id: 'drinks-2',
        name: 'Ipsum makgeolli',
        kr: '막걸리',
        description: LOREM,
        price: '$00',
        dish: 'drink',
      },
      {
        id: 'drinks-3',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM_SHORT,
        price: '$00',
        dish: 'drink',
        isNew: true,
      },
    ],
  },
  {
    id: 'desserts',
    title: 'Desserts',
    kr: '디저트',
    blurb: 'Lorem ipsum dolor sit amet, a sweet end to the night.',
    dishes: [
      {
        id: 'desserts-1',
        name: 'Lorem bingsu',
        kr: '빙수',
        description: LOREM,
        price: '$00',
        dish: 'dessert',
        pick: true,
        tags: ['vegetarian'],
      },
      {
        id: 'desserts-2',
        name: 'Ipsum hotteok',
        kr: '호떡',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'dessert',
        tags: ['vegetarian'],
      },
      {
        id: 'desserts-3',
        name: 'Dish name',
        kr: KR_PLACEHOLDER,
        description: LOREM,
        price: '$00',
        dish: 'dessert',
      },
    ],
  },
];

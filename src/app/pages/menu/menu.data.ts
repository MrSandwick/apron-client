import { DishKind } from '../../shared/dish-art/dish-art';

// Placeholder menu: every name, description and price below is filler so the layout can
// be built and reviewed. Real dishes and prices are out of scope this round.

// One dish card
export interface MenuDish {
  id: string;
  name: string;
  kr?: string;
  description: string;
  price: string;
  // Illustration shown in the image slot until a photo exists
  dish: DishKind;
  // Shows the "Ahjoomah's pick" sticker
  pick?: boolean;
  // Real photo, once one exists
  src?: string;
}

// One menu section with its heading copy and dishes
export interface MenuCategory {
  id: string;
  title: string;
  kr: string;
  blurb: string;
  dishes: MenuDish[];
}

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.';
const LOREM_SHORT = 'Lorem ipsum dolor sit amet, consectetur adipiscing.';

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
      },
      {
        id: 'bbq-2',
        name: 'Ipsum samgyeopsal',
        kr: '삼겹살',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'meat',
      },
      {
        id: 'bbq-3',
        name: 'Dolor bulgogi',
        kr: '불고기',
        description: LOREM,
        price: '$00',
        dish: 'meat',
        pick: true,
      },
      { id: 'bbq-4', name: 'Dish name', description: LOREM_SHORT, price: '$00', dish: 'grill' },
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
      },
      {
        id: 'stews-2',
        name: 'Ipsum stew',
        kr: '된장찌개',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'stew',
      },
      { id: 'stews-3', name: 'Dish name', description: LOREM, price: '$00', dish: 'stew' },
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
      },
      {
        id: 'rice-noodles-2',
        name: 'Ipsum naengmyeon',
        kr: '냉면',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'noodles',
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
        description: LOREM_SHORT,
        price: '$00',
        dish: 'noodles',
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
      },
      {
        id: 'banchan-2',
        name: 'Ipsum namul',
        kr: '나물',
        description: LOREM,
        price: '$00',
        dish: 'banchan',
      },
      {
        id: 'banchan-3',
        name: 'Dish name',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'banchan',
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
      { id: 'drinks-3', name: 'Dish name', description: LOREM_SHORT, price: '$00', dish: 'drink' },
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
      },
      {
        id: 'desserts-2',
        name: 'Ipsum hotteok',
        kr: '호떡',
        description: LOREM_SHORT,
        price: '$00',
        dish: 'dessert',
      },
      { id: 'desserts-3', name: 'Dish name', description: LOREM, price: '$00', dish: 'dessert' },
    ],
  },
];

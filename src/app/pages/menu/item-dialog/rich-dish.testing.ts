import { MenuDish, MenuOptionChoice } from '../menu.data';

function choice(
  id: string,
  extraMinor = 0,
  over: Partial<MenuOptionChoice> = {},
): MenuOptionChoice {
  return {
    id,
    name: id.toUpperCase(),
    kr: '',
    extraMinor,
    extra: extraMinor ? `+$${extraMinor / 100}` : '',
    preSelected: false,
    soldOut: false,
    ...over,
  };
}

// A dish that exercises every rule: a required pick-one with a pre-selected choice, a required
// pick-two, an optional pick-up-to-2 with surcharges and a sold-out choice, and a 200-character note
export const richDish: MenuDish = {
  id: 'rich',
  code: 'B7',
  name: 'Rich bowl',
  kr: '덮밥',
  description: 'A bowl with everything.',
  price: '$15',
  priceMinor: 1500,
  currency: 'USD',
  dish: 'rice',
  tags: ['mild', 'vegetarian'],
  noteMaxLength: 200,
  optionGroups: [
    {
      id: 'filling',
      name: 'Filling',
      kr: '',
      required: true,
      min: 1,
      max: 1,
      choices: [
        choice('beef', 0, { preSelected: true }),
        choice('tofu', 300),
        choice('pork', 0, { soldOut: true }),
      ],
    },
    {
      id: 'sides',
      name: 'Sides',
      kr: '',
      required: true,
      min: 2,
      max: 2,
      choices: [choice('rice'), choice('kimchi'), choice('egg')],
    },
    {
      id: 'extras',
      name: 'Extras',
      kr: '',
      required: false,
      min: 0,
      max: 2,
      choices: [
        choice('shrimp', 500),
        choice('cheese', 200),
        choice('onion', 100),
        choice('truffle', 900, { soldOut: true }),
      ],
    },
  ],
};

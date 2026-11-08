import { MenuDto } from './menu.dto';

// A small typed sample of the API's response. Specs flush it through the HTTP layer so they
// never depend on the placeholder data, and it covers the cases cards must handle: a photo,
// a sold-out dish, tags, NEW and the pick sticker, and a dish with no Korean name.
export const menuFixture: MenuDto = {
  version: '7',
  currency: 'USD',
  categories: [
    {
      id: 'bbq',
      title: 'BBQ',
      titleKr: '고기구이',
      blurb: 'Grilled at your table.',
      dishes: [
        {
          id: 'bbq-galbi',
          name: 'Galbi',
          nameKr: '갈비',
          description: 'Marinated short rib.',
          priceMinor: 2800,
          currency: 'USD',
          art: 'grill',
          image: {
            url: '/media/dishes/galbi-800.webp',
            width: 800,
            height: 600,
            alt: 'Galbi on the grill',
          },
          pick: true,
          isNew: false,
          soldOut: false,
          tags: ['mild'],
        },
        {
          id: 'bbq-pork-belly',
          name: 'Pork belly',
          nameKr: null,
          description: 'Thick-cut samgyeopsal.',
          priceMinor: 2400,
          currency: 'USD',
          art: 'meat',
          image: null,
          pick: false,
          isNew: true,
          soldOut: true,
          tags: ['spicy'],
        },
      ],
    },
    {
      id: 'banchan',
      title: 'Banchan',
      titleKr: '반찬',
      blurb: 'Small plates for the table.',
      dishes: [
        {
          id: 'banchan-kimchi',
          name: 'Kimchi',
          nameKr: '김치',
          description: 'House-fermented cabbage.',
          priceMinor: 600,
          currency: 'USD',
          art: 'banchan',
          image: null,
          pick: false,
          isNew: false,
          soldOut: false,
          tags: ['spicy', 'vegetarian'],
        },
      ],
    },
  ],
};

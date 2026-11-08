import { menuFixture } from '../../shared/api/menu.fixture';
import { formatPrice, toMenuCategories } from './menu.mapper';

describe('formatPrice', () => {
  it('drops the cents for whole amounts', () => {
    expect(formatPrice(2800, 'USD')).toBe('$28');
  });

  it('shows two decimals when there are cents', () => {
    expect(formatPrice(1850, 'USD')).toBe('$18.50');
  });

  it('returns the placeholder for a zero price', () => {
    expect(formatPrice(0, 'USD')).toBe('$00');
  });

  it('formats other currencies', () => {
    expect(formatPrice(1250, 'EUR')).toBe('€12.50');
  });

  // Zero-decimal currencies are not divided by 100
  it('uses the currency decimals: yen has none', () => {
    expect(formatPrice(1500, 'JPY')).toBe('¥1,500');
  });

  // A zero price only becomes the dollar placeholder for USD
  it('shows a formatted zero for other currencies', () => {
    expect(formatPrice(0, 'EUR')).toBe('€0');
  });

  // A bad currency code must not throw, or one dish would send the whole menu to the fallback
  it('does not throw on an invalid currency code', () => {
    expect(() => formatPrice(1850, 'not-a-code')).not.toThrow();
    expect(formatPrice(1850, 'not-a-code')).toBe('18.50 not-a-code');
  });
});

describe('toMenuCategories', () => {
  const categories = toMenuCategories(menuFixture);

  it('keeps the category order', () => {
    expect(categories.map((c) => c.id)).toEqual(menuFixture.categories.map((c) => c.id));
  });

  it('copies category copy and turns a null Korean title into empty', () => {
    const [first] = categories;
    expect(first.title).toBe(menuFixture.categories[0].title);
    expect(first.blurb).toBe(menuFixture.categories[0].blurb);
    expect(first.kr).toBe(menuFixture.categories[0].titleKr ?? '');
    const blank = toMenuCategories({
      ...menuFixture,
      categories: [{ ...menuFixture.categories[0], titleKr: null }],
    });
    expect(blank[0].kr).toBe('');
  });

  it('turns a null Korean dish name into empty', () => {
    const dtos = menuFixture.categories.flatMap((c) => c.dishes);
    const dishes = categories.flatMap((c) => c.dishes);
    dtos.forEach((dto, i) => {
      expect(dishes[i].kr).toBe(dto.nameKr ?? '');
    });
    expect(dtos.some((d) => d.nameKr === null)).toBe(true);
  });

  it('maps the image url to src and leaves it undefined without one', () => {
    const dtos = menuFixture.categories.flatMap((c) => c.dishes);
    const dishes = categories.flatMap((c) => c.dishes);
    dtos.forEach((dto, i) => {
      expect(dishes[i].src).toBe(dto.image?.url);
    });
  });

  it('passes flags, tags and art through and formats the price', () => {
    const dtos = menuFixture.categories.flatMap((c) => c.dishes);
    const dishes = categories.flatMap((c) => c.dishes);
    dtos.forEach((dto, i) => {
      expect(dishes[i]).toMatchObject({
        id: dto.id,
        name: dto.name,
        description: dto.description,
        dish: dto.art,
        pick: dto.pick,
        isNew: dto.isNew,
        soldOut: dto.soldOut,
        tags: dto.tags,
        price: formatPrice(dto.priceMinor, dto.currency),
      });
    });
  });
});

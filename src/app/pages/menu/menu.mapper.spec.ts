import { menuFixture } from '../../shared/api/menu.fixture';
import { formatExtra, formatExtraLabel, formatPrice, toMenuCategories } from './menu.mapper';

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

describe('formatExtra', () => {
  // Included choices show no surcharge text
  it('is empty for zero', () => {
    expect(formatExtra(0, 'USD')).toBe('');
  });

  it('shows whole dollars without cents', () => {
    expect(formatExtra(200, 'USD')).toBe('+$2');
  });

  it('shows cents when there are some', () => {
    expect(formatExtra(250, 'USD')).toBe('+$2.50');
  });

  it('formats other currencies', () => {
    expect(formatExtra(1500, 'JPY')).toBe('+¥1,500');
  });

  // The dollar placeholder is for dish prices only
  it('never returns the placeholder', () => {
    expect(formatExtra(0, 'USD')).not.toContain('$00');
    expect(formatExtra(-5, 'USD')).toBe('');
  });

  it('does not throw on an invalid currency code', () => {
    expect(() => formatExtra(250, 'not-a-code')).not.toThrow();
  });
});

describe('formatExtraLabel', () => {
  // The dialog shows every surcharge in one format: a plus sign, a space and the full amount
  it('always shows the full amount, including free choices', () => {
    expect(formatExtraLabel(0, 'USD')).toBe('+ $0.00');
    expect(formatExtraLabel(200, 'USD')).toBe('+ $2.00');
    expect(formatExtraLabel(250, 'USD')).toBe('+ $2.50');
  });

  // Zero-decimal currencies keep their own decimals
  it('uses the currency decimals', () => {
    expect(formatExtraLabel(500, 'JPY')).toBe('+ ¥500');
  });

  // An invalid currency code must not throw
  it('does not throw on an invalid currency code', () => {
    expect(() => formatExtraLabel(200, 'not-a-code')).not.toThrow();
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

  // Code, featured, price parts and note length come across; a null code becomes undefined
  it('maps code, featured, price parts and note length', () => {
    const dishes = categories.flatMap((c) => c.dishes);
    const galbi = dishes[0];
    expect(galbi.code).toBe('B1');
    expect(galbi.featured).toBe(true);
    expect(galbi.priceMinor).toBe(2800);
    expect(galbi.currency).toBe('USD');
    expect(galbi.noteMaxLength).toBe(200);
    expect(dishes[1].code).toBeUndefined();
  });

  // Category group is undefined when the API sends null
  it('maps the category group and leaves null undefined', () => {
    expect(categories[0].group).toBe('MAIN');
    const none = toMenuCategories({
      ...menuFixture,
      categories: [{ ...menuFixture.categories[0], group: null }],
    });
    expect(none[0].group).toBeUndefined();
  });

  // Option groups keep their order, with surcharge text, preselected and sold-out choices
  it('maps option groups and choices', () => {
    const [galbi, belly] = categories[0].dishes;
    expect(belly.optionGroups).toEqual([]);
    const [cut, extras] = galbi.optionGroups ?? [];
    expect(cut).toMatchObject({ id: 'bbq-galbi-cut', kr: '', required: true, min: 1, max: 1 });
    expect(cut.choices[0]).toMatchObject({ extraMinor: 0, extra: '', preSelected: true });
    expect(cut.choices[1]).toMatchObject({ extraMinor: 300, extra: '+$3', preSelected: false });
    expect(extras.max).toBe(3);
    expect(extras.choices.map((c) => c.extra)).toEqual(['+$2', '+$7', '+$1.50']);
    expect(extras.choices[0].kr).toBe('밥');
    expect(extras.choices[2].soldOut).toBe(true);
    expect(extras.choices[2].kr).toBe('');
  });
});

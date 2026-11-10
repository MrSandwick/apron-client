import { formatAmount, formatPrice } from './price';

describe('formatPrice', () => {
  // Whole dollar amounts drop the cents
  it('drops the cents for whole amounts', () => {
    expect(formatPrice(2800, 'USD')).toBe('$28');
  });

  // Anything with cents keeps two decimals
  it('shows two decimals when there are cents', () => {
    expect(formatPrice(1850, 'USD')).toBe('$18.50');
  });

  // The menu placeholder for a dish with no price yet
  it('returns the placeholder for a zero dollar price', () => {
    expect(formatPrice(0, 'USD')).toBe('$00');
  });

  // The currency symbol follows the code
  it('uses the symbol of the currency', () => {
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

describe('formatAmount', () => {
  // Real zero amounts (cart totals, free choices) read as a plain zero, never the placeholder
  it('formats a zero dollar amount as $0', () => {
    expect(formatAmount(0, 'USD')).toBe('$0');
  });

  // Whole amounts drop the cents
  it('drops the cents for whole amounts', () => {
    expect(formatAmount(4400, 'USD')).toBe('$44');
  });

  // Amounts with cents keep two decimals
  it('shows two decimals when there are cents', () => {
    expect(formatAmount(1250, 'USD')).toBe('$12.50');
  });

  // The currency symbol follows the code
  it('uses the symbol of the currency', () => {
    expect(formatAmount(1250, 'EUR')).toBe('€12.50');
    expect(formatAmount(1500, 'JPY')).toBe('¥1,500');
  });

  // An unknown code falls back to the plain amount with the code
  it('does not throw on an invalid currency code', () => {
    expect(formatAmount(1850, 'not-a-code')).toBe('18.50 not-a-code');
  });
});

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

// The currency-aware amount formatting shared by prices and surcharges
export function formatAmount(minor: number, currency: string): string {
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

// Quantity bounds for one line. The original ordering page states no maximum, so 20 is our own choice
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

// Whole quantity within the bounds; anything that is not a number becomes the minimum
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return MIN_QUANTITY;
  }
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

// One option a guest picked on a cart line
export interface CartPick {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  extraMinor: number;
}

// One line in the cart: a dish with its picks, note and quantity. The cart is single-currency:
// all lines share one currency, and CartService.add refuses a line in another
export interface CartLine {
  // Identity of the dish + picks + note; lines with the same key merge
  key: string;
  dishId: string;
  code?: string;
  name: string;
  quantity: number;
  picks: CartPick[];
  note: string;
  // Price of one portion and of the whole line, in minor units
  unitMinor: number;
  totalMinor: number;
  currency: string;
}

// What the dialog hands to the cart: a line before it has a key or a total
export type NewCartLine = Omit<CartLine, 'key' | 'totalMinor'>;

// Key that makes two lines identical: same dish, same picks (order-insensitive) and same note
export function lineKey(line: Pick<CartLine, 'dishId' | 'picks' | 'note'>): string {
  const picks = line.picks
    .map((p) => `${p.groupId}:${p.choiceId}`)
    .sort()
    .join(',');
  return JSON.stringify([line.dishId, picks, line.note.trim()]);
}

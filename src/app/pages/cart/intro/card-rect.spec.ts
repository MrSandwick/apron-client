import { describe, expect, it } from 'vitest';
import { unionRect } from './card-rect';

const card = { x: 10, y: 20, width: 400, height: 500 };

describe('unionRect', () => {
  // The edge hangs below the card, so the union runs from the card top to the edge bottom
  it('joins the card with the torn edge under it', () => {
    const edge = { x: 10, y: 519, width: 400, height: 12 };
    expect(unionRect(card, edge)).toEqual({ x: 10, y: 20, width: 400, height: 511 });
  });

  // A wider edge widens the union on both sides
  it('grows to cover an edge wider than the card', () => {
    const edge = { x: 0, y: 519, width: 430, height: 12 };
    expect(unionRect(card, edge)).toEqual({ x: 0, y: 20, width: 430, height: 511 });
  });

  // No edge, or one without area, leaves the card alone
  it('returns the card when the edge is missing or empty', () => {
    expect(unionRect(card, null)).toEqual(card);
    expect(unionRect(card, { x: 0, y: 0, width: 0, height: 12 })).toEqual(card);
  });

  // Nothing to land on without a sized card
  it('returns null when the card is missing or has no size', () => {
    expect(unionRect(null, null)).toBeNull();
    expect(unionRect({ ...card, height: 0 }, { x: 0, y: 0, width: 5, height: 5 })).toBeNull();
  });
});

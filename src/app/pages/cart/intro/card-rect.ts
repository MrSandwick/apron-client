import { LandingRect } from './intro-contract';

// The part of a DOMRect the intro reads, so tests can pass plain boxes
export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

const hasArea = (rect: RectLike | null | undefined): rect is RectLike =>
  !!rect && rect.width > 0 && rect.height > 0;

// The card joined with its torn edge (card top to edge bottom), or null when the card has no
// size; a missing or empty edge leaves the card alone
export function unionRect(
  card: RectLike | null | undefined,
  edge: RectLike | null | undefined,
): LandingRect | null {
  if (!hasArea(card)) return null;
  if (!hasArea(edge)) {
    return { x: card.x, y: card.y, width: card.width, height: card.height };
  }
  const left = Math.min(card.x, edge.x);
  const top = Math.min(card.y, edge.y);
  const right = Math.max(card.x + card.width, edge.x + edge.width);
  const bottom = Math.max(card.y + card.height, edge.y + edge.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

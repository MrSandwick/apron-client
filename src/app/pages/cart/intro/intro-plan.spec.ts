import { describe, expect, it } from 'vitest';
import { BEATS } from './intro-plan';

describe('BEATS', () => {
  it('has the agreed total', () => {
    expect(BEATS.total).toBe(3.55);
  });

  // The page reveals the moment the ticket has landed, then the canvas fades
  it('lands, reveals and fades in that order', () => {
    expect(BEATS).toMatchObject({ cut: 2.35, fly: 3.25, reveal: 3.25, fadeStart: 3.25 });
    // The hand-off fade is invisible (the ticket texture and sky match the card), so it stays short
    expect(BEATS.fadeEnd).toBe(3.5);
  });

  it('keeps moments in order and reveal before total', () => {
    // Each moment follows the one before it, and the page reveals before the end
    expect(BEATS.pop).toBeLessThan(BEATS.feed);
    expect(BEATS.feed).toBeLessThan(BEATS.cut);
    expect(BEATS.cut).toBeLessThan(BEATS.fly);
    expect(BEATS.reveal).toBeLessThan(BEATS.total);
    expect(BEATS.fadeStart).toBeLessThan(BEATS.fadeEnd);
    expect(BEATS.fadeEnd).toBeLessThan(BEATS.total);
  });
});

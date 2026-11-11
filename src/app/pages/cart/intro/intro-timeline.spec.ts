import { gsap } from 'gsap';
import { describe, expect, it, vi } from 'vitest';
import { initialIntroState } from './intro-contract';
import { BEATS } from './intro-plan';
import { IntroFade, buildIntroTimeline } from './intro-timeline';

// Builds a timeline with spy callbacks and pauses it so the test drives the playhead
function setup() {
  const state = initialIntroState();
  const fade: IntroFade = { value: 1 };
  const order: string[] = [];
  const callbacks = {
    onFrame: vi.fn(),
    onReveal: vi.fn(() => order.push('reveal')),
    onDone: vi.fn(() => order.push('done')),
  };
  const tl = buildIntroTimeline(gsap, state, callbacks, fade);
  tl.pause(0);
  return { tl, state, fade, order, callbacks };
}

describe('buildIntroTimeline', () => {
  it('lasts the planned total', () => {
    const { tl } = setup();
    // Duration follows BEATS within a frame or so
    expect(Math.abs(tl.duration() - BEATS.total)).toBeLessThan(0.05);
    tl.kill();
  });

  it('fires reveal before done, once each', () => {
    const { tl, order, callbacks } = setup();
    tl.progress(1, false);
    // Reveal comes first and neither callback repeats
    expect(order).toEqual(['reveal', 'done']);
    expect(callbacks.onReveal).toHaveBeenCalledTimes(1);
    expect(callbacks.onDone).toHaveBeenCalledTimes(1);
    tl.kill();
  });

  it('ends with the ticket landed', () => {
    const { tl, state, fade } = setup();
    tl.progress(1, false);
    // Final state: printed, cut, landed, printer gone, uncurled, light done, canvas faded
    expect(state.pop).toBe(1);
    expect(state.feed).toBe(1);
    expect(state.cut).toBe(1);
    expect(state.fly).toBe(1);
    expect(state.exit).toBe(1);
    expect(state.curl).toBe(0);
    expect(state.ledDone).toBe(1);
    expect(state.squash).toBe(0);
    expect(state.jitter).toBe(0);
    expect(fade.value).toBe(0);
    tl.kill();
  });

  it('reports a frame on every update', () => {
    const { tl, callbacks } = setup();
    tl.progress(0.5, false);
    // onUpdate is wired to onFrame
    expect(callbacks.onFrame).toHaveBeenCalled();
    tl.kill();
  });

  it('feeds in six steps', () => {
    const { tl, state } = setup();
    // Just after the third jerk's step finishes, half the ticket is out
    tl.time(0.6 + 2 * 0.25 + 0.18, false);
    expect(state.feed).toBeCloseTo(0.5, 5);
    tl.kill();
  });

  it('aims the landing at the cut beat', () => {
    const state = initialIntroState();
    const onLand = vi.fn();
    const tl = buildIntroTimeline(
      gsap,
      state,
      { onFrame: vi.fn(), onLand, onReveal: vi.fn(), onDone: vi.fn() },
      { value: 1 },
    );
    tl.pause(0);
    tl.time(BEATS.cut - 0.02, false);
    // Not yet: the ticket is still being torn off
    expect(onLand).not.toHaveBeenCalled();
    tl.time(BEATS.cut + 0.02, false);
    expect(onLand).toHaveBeenCalledTimes(1);
    tl.kill();
  });

  it('removes the printer before the ticket lands and keeps the canvas until then', () => {
    const { tl, state, fade } = setup();
    const { cut, fly } = BEATS;
    // Printer is gone after 70 percent of the landing, the ticket after all of it
    tl.time(cut + 0.7 * (fly - cut) + 0.01, false);
    expect(state.exit).toBe(1);
    expect(state.fly).toBeLessThan(1);
    expect(fade.value).toBe(1);
    tl.time(fly + 0.05, false);
    expect(state.fly).toBe(1);
    expect(fade.value).toBeLessThan(1);
    tl.kill();
  });

  it('does not reveal early when seeking before the reveal beat', () => {
    const { tl, callbacks } = setup();
    tl.time(BEATS.reveal - 0.1, false);
    // Still before the reveal moment
    expect(callbacks.onReveal).not.toHaveBeenCalled();
    tl.kill();
  });

  // timeScale changes playback speed only, so the planned timeline and its order stay as they are
  it('keeps its duration and order when the speed is raised', () => {
    const { tl, order } = setup();
    tl.timeScale(6);
    expect(Math.abs(tl.duration() - BEATS.total)).toBeLessThan(0.05);
    tl.progress(1, false);
    expect(order).toEqual(['reveal', 'done']);
    tl.kill();
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tweenedNumber } from './tween';

describe('tweenedNumber', () => {
  const win = window as unknown as { matchMedia?: unknown };
  let hadMatchMedia = false;
  let originalMatchMedia: unknown;

  // Stub matchMedia so the no-preference query reports `motionOn`
  function stubMatchMedia(motionOn: boolean) {
    win.matchMedia = (query: string) => ({
      matches: query.includes('no-preference') ? motionOn : false,
    });
  }

  // Build a tween plus its source inside an injection context
  function setup(initial: number) {
    const source = signal(initial);
    const tween = TestBed.runInInjectionContext(() => tweenedNumber(source, 400));
    TestBed.tick();
    return { source, tween };
  }

  beforeEach(() => {
    // Remember whatever matchMedia existed before this test (the test-setup stub, or none)
    hadMatchMedia = 'matchMedia' in win;
    originalMatchMedia = win.matchMedia;
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    // Put back exactly what was there before, and real timers
    if (hadMatchMedia) {
      win.matchMedia = originalMatchMedia;
    } else {
      delete win.matchMedia;
    }
    vi.useRealTimers();
  });

  it('starts on the source value', () => {
    // No count-up from zero
    const { tween } = setup(1200);
    expect(tween()).toBe(1200);
  });

  it('jumps immediately without a motion preference', () => {
    // The test-setup stub reports no motion preference, so motionAllowed() is false
    const { source, tween } = setup(100);
    source.set(900);
    TestBed.tick();
    expect(tween()).toBe(900);
  });

  it('passes through an intermediate value and ends exactly on the target', () => {
    // Motion on: halfway through the duration the value is between start and target
    stubMatchMedia(true);
    const { source, tween } = setup(0);
    source.set(1000);
    TestBed.tick();
    expect(tween()).toBe(0);

    vi.advanceTimersByTime(200);
    expect(tween()).toBeGreaterThan(0);
    expect(tween()).toBeLessThan(1000);

    vi.advanceTimersByTime(400);
    expect(tween()).toBe(1000);
  });

  it('restarts from the current value when the source changes mid-tween', () => {
    stubMatchMedia(true);
    const { source, tween } = setup(0);
    source.set(1000);
    TestBed.tick();
    vi.advanceTimersByTime(200);
    const midway = tween();
    expect(midway).toBeGreaterThan(0);

    // New target: no jump, then it continues from the midway value to the new target
    source.set(2000);
    TestBed.tick();
    expect(tween()).toBe(midway);

    vi.advanceTimersByTime(100);
    expect(tween()).toBeGreaterThan(midway);
    expect(tween()).toBeLessThan(2000);

    vi.advanceTimersByTime(500);
    expect(tween()).toBe(2000);
  });

  it('jumps immediately under reduced motion', () => {
    // Reduced motion: motionAllowed() is false even though matchMedia exists
    stubMatchMedia(false);
    const { source, tween } = setup(0);
    source.set(1000);
    TestBed.tick();
    expect(tween()).toBe(1000);
  });
});

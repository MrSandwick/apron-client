import { afterEach, describe, expect, it, vi } from 'vitest';
import { onScrollFrame } from './motion';

describe('onScrollFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Runs queued frames straight away and lets a test place the section in the viewport
  function setup(top: number) {
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const section = document.createElement('div');
    let rectTop = top;
    vi.spyOn(section, 'getBoundingClientRect').mockImplementation(
      () => ({ top: rectTop, height: 500 }) as DOMRect,
    );
    return { section, move: (t: number) => (rectTop = t) };
  }

  // One frame runs at once, then one per scroll while the section is near the viewport
  it('runs now and on scroll while the section is near the viewport', () => {
    const { section } = setup(100);
    const frame = vi.fn();
    const stop = onScrollFrame(section, frame);
    expect(frame).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('scroll'));
    expect(frame).toHaveBeenCalledTimes(2);
    stop();
  });

  // Far off screen (progress well outside 0..1) scroll events do no work, and it resumes on re-entry
  it('skips frames while the section is far off screen and resumes when it returns', () => {
    const { section, move } = setup(100);
    const frame = vi.fn();
    const stop = onScrollFrame(section, frame);
    move(-5000);
    window.dispatchEvent(new Event('scroll'));
    expect(frame).toHaveBeenCalledTimes(1);
    move(100);
    window.dispatchEvent(new Event('scroll'));
    expect(frame).toHaveBeenCalledTimes(2);
    stop();
  });

  // Teardown removes the listeners
  it('stops after teardown', () => {
    const { section } = setup(100);
    const frame = vi.fn();
    onScrollFrame(section, frame)();
    window.dispatchEvent(new Event('scroll'));
    expect(frame).toHaveBeenCalledTimes(1);
  });
});

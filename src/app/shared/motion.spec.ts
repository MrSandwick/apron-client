import { afterEach, describe, expect, it, vi } from 'vitest';
import { onScrollFrame } from './motion';

describe('onScrollFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Queues animation frames like a browser (the callback runs after requestAnimationFrame
  // returns) so a test flushes them by hand, and lets a test place the section in the viewport
  function setup(top: number) {
    let queued: (() => void) | undefined;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      queued = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      queued = undefined;
    });
    const section = document.createElement('div');
    let rectTop = top;
    vi.spyOn(section, 'getBoundingClientRect').mockImplementation(
      () => ({ top: rectTop, height: 500 }) as DOMRect,
    );
    // Fires a scroll event and then the animation frame it scheduled
    const scroll = () => {
      window.dispatchEvent(new Event('scroll'));
      const run = queued;
      queued = undefined;
      run?.();
    };
    return { section, move: (t: number) => (rectTop = t), scroll };
  }

  // One frame runs at once, then one per scroll while the section is near the viewport
  it('runs now and on scroll while the section is near the viewport', () => {
    const { section, scroll } = setup(100);
    const frame = vi.fn();
    const stop = onScrollFrame(section, frame);
    expect(frame).toHaveBeenCalledTimes(1);
    scroll();
    expect(frame).toHaveBeenCalledTimes(2);
    stop();
  });

  // Far off screen (progress well outside 0..1) scroll events do no work, and it resumes on re-entry
  it('skips frames while the section is far off screen and resumes when it returns', () => {
    const { section, move, scroll } = setup(100);
    const frame = vi.fn();
    const stop = onScrollFrame(section, frame);
    move(-5000);
    scroll();
    expect(frame).toHaveBeenCalledTimes(1);
    move(100);
    scroll();
    expect(frame).toHaveBeenCalledTimes(2);
    stop();
  });

  // Teardown removes the listeners
  it('stops after teardown', () => {
    const { section, scroll } = setup(100);
    const frame = vi.fn();
    onScrollFrame(section, frame)();
    scroll();
    expect(frame).toHaveBeenCalledTimes(1);
  });
});

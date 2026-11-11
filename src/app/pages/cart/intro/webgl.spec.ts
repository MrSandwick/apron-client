import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWebglProbe, webglAvailable } from './webgl';

describe('webglAvailable', () => {
  beforeEach(() => resetWebglProbe());

  afterEach(() => {
    vi.restoreAllMocks();
    resetWebglProbe();
  });

  // jsdom has no WebGL: the probe gets a fake context, or none
  function stubContext(gl: unknown) {
    return vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => gl) as never);
  }

  it('creates the probe context once and returns the cached answer after that', () => {
    const lose = vi.fn();
    const getContext = stubContext({ getExtension: () => ({ loseContext: lose }) });
    expect(webglAvailable()).toBe(true);
    expect(webglAvailable()).toBe(true);
    // One probe context, handed back at once
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(lose).toHaveBeenCalledTimes(1);
  });

  it('caches a negative answer too', () => {
    const getContext = stubContext(null);
    expect(webglAvailable()).toBe(false);
    expect(webglAvailable()).toBe(false);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('probes again after a reset', () => {
    const getContext = stubContext(null);
    webglAvailable();
    resetWebglProbe();
    webglAvailable();
    expect(getContext).toHaveBeenCalledTimes(2);
  });

  it('reports false when the probe throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      throw new Error('blocked');
    }) as never);
    expect(webglAvailable()).toBe(false);
  });
});

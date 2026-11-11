import {
  budget,
  clamp,
  lerpColor,
  mulberry32,
  readPalette,
  withAlpha,
} from './backdrop-kit';

// Remembers original property descriptors so each test can restore the environment
const restorers: (() => void)[] = [];

function stub(target: object, prop: string, value: unknown): void {
  const original = Object.getOwnPropertyDescriptor(target, prop);
  Object.defineProperty(target, prop, { value, configurable: true, writable: true });
  restorers.push(() => {
    if (original) {
      Object.defineProperty(target, prop, original);
    } else {
      delete (target as Record<string, unknown>)[prop];
    }
  });
}

// Sets up a viewport, core count, pixel ratio and small-screen media match
function stubDevice(opts: {
  width: number;
  height: number;
  cores: number;
  dpr: number;
  small: boolean;
  saveData?: boolean;
}): void {
  stub(window, 'innerWidth', opts.width);
  stub(window, 'innerHeight', opts.height);
  stub(window, 'devicePixelRatio', opts.dpr);
  stub(window, 'matchMedia', (query: string) => ({
    matches: opts.small && query.includes('640px'),
    media: query,
  }));
  stub(navigator, 'hardwareConcurrency', opts.cores);
  stub(navigator, 'connection', opts.saveData ? { saveData: true } : undefined);
}

afterEach(() => {
  while (restorers.length) {
    restorers.pop()?.();
  }
});

describe('budget', () => {
  it('gives a full desktop the top scale and a dpr capped at 2', () => {
    stubDevice({ width: 1440, height: 900, cores: 8, dpr: 3, small: false });
    const b = budget();
    expect(b.scale).toBe(1);
    expect(b.dpr).toBe(2);
    expect(b.lowPower).toBe(false);
  });

  it('lowers scale and caps dpr at 1.5 on a small screen', () => {
    stubDevice({ width: 390, height: 844, cores: 8, dpr: 3, small: true });
    const b = budget();
    expect(b.scale).toBeLessThan(1);
    expect(b.scale).toBeGreaterThanOrEqual(0.4);
    expect(b.dpr).toBe(1.5);
    expect(b.lowPower).toBe(true);
  });

  it('flags low power and trims scale on a low core count', () => {
    stubDevice({ width: 1440, height: 900, cores: 2, dpr: 2, small: false });
    const b = budget();
    expect(b.scale).toBeLessThan(1);
    expect(b.dpr).toBe(1.5);
    expect(b.lowPower).toBe(true);
  });

  it('flags low power when data saver is on', () => {
    stubDevice({ width: 1440, height: 900, cores: 8, dpr: 2, small: false, saveData: true });
    const b = budget();
    expect(b.scale).toBeLessThan(1);
    expect(b.lowPower).toBe(true);
  });

  it('never drops below the minimum scale', () => {
    stubDevice({ width: 200, height: 200, cores: 2, dpr: 1, small: true, saveData: true });
    expect(budget().scale).toBe(0.4);
  });

  it('never exceeds the maximum scale on a huge viewport', () => {
    stubDevice({ width: 3840, height: 2160, cores: 16, dpr: 1, small: false });
    expect(budget().scale).toBe(1);
  });

  it('keeps a dpr below the cap unchanged', () => {
    stubDevice({ width: 1440, height: 900, cores: 8, dpr: 1, small: false });
    expect(budget().dpr).toBe(1);
  });

  it('does not throw when matchMedia is missing', () => {
    stubDevice({ width: 1440, height: 900, cores: 8, dpr: 1, small: false });
    stub(window, 'matchMedia', undefined);
    expect(() => budget()).not.toThrow();
  });
});

describe('clamp', () => {
  it('limits a value to the given range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('lerpColor', () => {
  it('returns the endpoints for hex input', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('rgb(0, 0, 0)');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('rgb(255, 255, 255)');
  });

  it('returns the midpoint for hex input', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
  });

  it('expands short hex values', () => {
    expect(lerpColor('#f00', '#00f', 0)).toBe('rgb(255, 0, 0)');
    expect(lerpColor('#f00', '#00f', 1)).toBe('rgb(0, 0, 255)');
  });

  it('handles rgb input at the endpoints and midpoint', () => {
    expect(lerpColor('rgb(0, 100, 200)', 'rgb(100, 200, 0)', 0)).toBe('rgb(0, 100, 200)');
    expect(lerpColor('rgb(0, 100, 200)', 'rgb(100, 200, 0)', 1)).toBe('rgb(100, 200, 0)');
    expect(lerpColor('rgb(0, 100, 200)', 'rgb(100, 200, 0)', 0.5)).toBe('rgb(50, 150, 100)');
  });

  it('blends alpha for rgba input and returns rgba', () => {
    expect(lerpColor('rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('clamps t outside 0..1', () => {
    expect(lerpColor('#000000', '#ffffff', -3)).toBe('rgb(0, 0, 0)');
    expect(lerpColor('#000000', '#ffffff', 7)).toBe('rgb(255, 255, 255)');
  });

  it('mixes hex with rgb input', () => {
    expect(lerpColor('#ff0000', 'rgb(0, 0, 255)', 1)).toBe('rgb(0, 0, 255)');
  });
});

describe('withAlpha', () => {
  it('adds alpha to a hex color', () => {
    expect(withAlpha('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('replaces the alpha of an rgba color', () => {
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.25)).toBe('rgba(10, 20, 30, 0.25)');
  });

  it('returns plain rgb at full alpha and clamps out-of-range alpha', () => {
    expect(withAlpha('#102030', 1)).toBe('rgb(16, 32, 48)');
    expect(withAlpha('#102030', 5)).toBe('rgb(16, 32, 48)');
    expect(withAlpha('#102030', -1)).toBe('rgba(16, 32, 48, 0)');
  });
});

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays within 0 and 1', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('readPalette', () => {
  const keys = ['amber', 'apron', 'sun', 'sunSet', 'skyDawn'] as const;

  it('falls back to non-empty defaults when the properties are empty', () => {
    const p = readPalette();
    for (const k of keys) {
      expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('prefers a value set on the root element', () => {
    document.documentElement.style.setProperty('--color-brand-amber', '#123456');
    try {
      expect(readPalette().amber).toBe('#123456');
    } finally {
      document.documentElement.style.removeProperty('--color-brand-amber');
    }
  });
});

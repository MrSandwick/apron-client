import { Budget, Palette } from './backdrop-scene';

// Fallbacks match the @theme tokens in styles.css
const PALETTE_DEFAULTS: Record<keyof Palette, string> = {
  amber: '#f0a500',
  apron: '#c8312b',
  sun: '#f4c26b',
  sunSet: '#e8865a',
  skyDawn: '#b8ccd5',
};

// Palette key to CSS custom property
const PALETTE_VARS: Record<keyof Palette, string> = {
  amber: '--color-brand-amber',
  apron: '--color-brand-apron',
  sun: '--color-sun',
  sunSet: '--color-sun-set',
  skyDawn: '--color-sky-dawn',
};

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Reads the design tokens from the root element, falling back to defaults when unset
export function readPalette(): Palette {
  const out = { ...PALETTE_DEFAULTS };
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return out;
  }
  let style: CSSStyleDeclaration;
  try {
    style = getComputedStyle(document.documentElement);
  } catch {
    return out;
  }
  for (const key of Object.keys(PALETTE_VARS) as (keyof Palette)[]) {
    const value = style.getPropertyValue(PALETTE_VARS[key]).trim();
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Parses #rgb, #rrggbb, rgb() and rgba(); unknown input becomes opaque black
function parseColor(input: string): Rgba {
  const s = input.trim().toLowerCase();

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if ((hex.length === 6 || hex.length === 8) && /^[0-9a-f]+$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      const num = (p: string): number =>
        p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);
      const alpha =
        parts.length >= 4
          ? parts[3].endsWith('%')
            ? parseFloat(parts[3]) / 100
            : parseFloat(parts[3])
          : 1;
      const r = num(parts[0]);
      const g = num(parts[1]);
      const b = num(parts[2]);
      if (![r, g, b, alpha].some(Number.isNaN)) {
        return {
          r: clamp(r, 0, 255),
          g: clamp(g, 0, 255),
          b: clamp(b, 0, 255),
          a: clamp(alpha, 0, 1),
        };
      }
    }
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function format({ r, g, b, a }: Rgba): string {
  const rr = Math.round(r);
  const gg = Math.round(g);
  const bb = Math.round(b);
  // Alpha is rounded to avoid float noise in the string
  const aa = Math.round(a * 1000) / 1000;
  return aa >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${aa})`;
}

// Linear blend of two colors; t is clamped to 0..1
export function lerpColor(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1);
  const ca = parseColor(a);
  const cb = parseColor(b);
  return format({
    r: ca.r + (cb.r - ca.r) * k,
    g: ca.g + (cb.g - ca.g) * k,
    b: ca.b + (cb.b - ca.b) * k,
    a: ca.a + (cb.a - ca.a) * k,
  });
}

// Replaces the alpha channel of a color
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return format({ ...c, a: clamp(alpha, 0, 1) });
}

// Small seeded PRNG returning values in [0, 1)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NavigatorWithConnection {
  connection?: { saveData?: boolean };
}

// Picks particle scale and pixel ratio from viewport size and device hints
export function budget(): Budget {
  const hasWindow = typeof window !== 'undefined';
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  // Viewport area relative to a 1440x900 desktop
  const w = hasWindow && window.innerWidth > 0 ? window.innerWidth : 1440;
  const h = hasWindow && window.innerHeight > 0 ? window.innerHeight : 900;
  let scale = (w * h) / (1440 * 900);
  let lowPower = false;

  // Phone-sized viewport
  let small = false;
  if (hasWindow && typeof window.matchMedia === 'function') {
    try {
      small = window.matchMedia('(max-width: 640px)').matches;
    } catch {
      small = false;
    }
  }
  if (small) {
    scale *= 0.75;
    lowPower = true;
  }

  // Few CPU cores
  const cores = nav?.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) {
    scale *= 0.8;
    lowPower = true;
  }

  // Data saver requested
  if ((nav as NavigatorWithConnection | undefined)?.connection?.saveData) {
    scale *= 0.7;
    lowPower = true;
  }

  const ratio = (hasWindow && window.devicePixelRatio) || 1;
  return {
    scale: clamp(scale, 0.4, 1),
    dpr: Math.min(ratio, lowPower ? 1.5 : 2),
    lowPower,
  };
}

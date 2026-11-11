import { BackdropScene, Budget, Frame, Palette, SceneFactory } from './backdrop-scene';
import { clamp, lerpColor, withAlpha } from './backdrop-kit';

// Palette keys the discs are tinted with
const COLOR_KEYS = ['amber', 'sun', 'sunSet', 'apron'] as const;

// Sprite radii in px; each disc uses the nearest bucket and scales it
const RADIUS_BUCKETS = [40, 64, 90, 116, 140];

const MIN_RADIUS = 30;
const MAX_RADIUS = 140;
const DESKTOP_DISCS = 18;
const PHONE_DISCS = 10;
const MIN_DISCS = 6;

// Largest drift distance from home on either axis, in px
export const BOKEH_MAX_DRIFT = 40;

// Parallax shift in px at full pointer travel for the nearest layer (depth 1)
export const BOKEH_PARALLAX_X = 60;
export const BOKEH_PARALLAX_Y = 42;

// Depth of the largest, farthest disc; the smallest, nearest disc sits at 1
export const BOKEH_MIN_DEPTH = 0.15;

// Mood is snapped to this many steps so the sprite cache stays small
const MOOD_STEPS = 8;
const MAX_CACHED_SPRITES = 96;

// Top band stays calm for the title: min factor up to CALM_FROM, full strength from CALM_TO
const CALM_FROM = 140;
const CALM_TO = 320;
const CALM_MIN = 0.35;

interface Disc {
  // Home as a fraction of the (oversized) area so resize keeps proportions
  fx: number;
  fy: number;
  radius: number;
  bucket: number;
  colorIdx: number;
  alpha: number;
  // Parallax depth, 1 for the smallest (nearest) discs down to BOKEH_MIN_DEPTH for the largest
  depth: number;
  ampX: number;
  ampY: number;
  wx: number;
  wy: number;
  phx: number;
  phy: number;
  breatheW: number;
  breatheP: number;
}

// Smooth 0.35 to 1 factor of y so the title area stays calm
function calmFactor(y: number): number {
  const t = clamp((y - CALM_FROM) / (CALM_TO - CALM_FROM), 0, 1);
  const eased = t * t * (3 - 2 * t);
  return CALM_MIN + (1 - CALM_MIN) * eased;
}

function nearestBucket(radius: number): number {
  let best = 0;
  for (let i = 1; i < RADIUS_BUCKETS.length; i++) {
    if (Math.abs(RADIUS_BUCKETS[i] - radius) < Math.abs(RADIUS_BUCKETS[best] - radius)) {
      best = i;
    }
  }
  return best;
}

// Soft centre, brighter rim ring, then a fade to transparent
function addDiscStops(grad: CanvasGradient, color: string): void {
  grad.addColorStop(0, withAlpha(color, 0.5));
  grad.addColorStop(0.7, withAlpha(color, 0.55));
  grad.addColorStop(0.88, withAlpha(color, 0.8));
  grad.addColorStop(1, withAlpha(color, 0));
}

// Renders one disc sprite offscreen; null where canvas is unavailable
function makeSprite(color: string, radius: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const g = canvas.getContext('2d');
    if (!g) {
      return null;
    }
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    addDiscStops(grad, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    return canvas;
  } catch {
    return null;
  }
}

export const bokehScene: SceneFactory = (budget: Budget, rand: () => number): BackdropScene => {
  const base = budget.lowPower ? PHONE_DISCS : DESKTOP_DISCS;
  const count = Math.max(MIN_DISCS, Math.round(base * budget.scale));

  // Same number of rand() calls per disc keeps a seed reproducible
  let discs: Disc[] = [];
  for (let i = 0; i < count; i++) {
    const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * rand();
    const fx = rand();
    const fy = rand();
    const colorIdx = Math.min(COLOR_KEYS.length - 1, Math.floor(rand() * COLOR_KEYS.length));
    const alpha = 0.06 + 0.12 * rand();
    const speedX = 2 + 4 * rand();
    const speedY = 2 + 4 * rand();
    const wx = 0.15 + 0.15 * rand();
    const wy = 0.15 + 0.15 * rand();
    const phx = Math.PI * 2 * rand();
    const phy = Math.PI * 2 * rand();
    const breathePeriod = 8 + 6 * rand();
    const breatheP = Math.PI * 2 * rand();

    // Peak speed of a sine is amplitude * omega, so amplitude = speed / omega
    discs.push({
      fx,
      fy,
      radius,
      bucket: nearestBucket(radius),
      colorIdx,
      alpha,
      depth: 1 - (1 - BOKEH_MIN_DEPTH) * ((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)),
      ampX: Math.min(speedX / wx, BOKEH_MAX_DRIFT),
      ampY: Math.min(speedY / wy, BOKEH_MAX_DRIFT),
      wx,
      wy,
      phx,
      phy,
      breatheW: (Math.PI * 2) / breathePeriod,
      breatheP,
    });
  }

  let width = 0;
  let height = 0;
  // Own clock so a scene that is never stepped draws a fixed static frame
  let clock = 0;
  // Sprites keyed by an integer built from mood step, colour index and radius bucket
  let sprites = new Map<number, HTMLCanvasElement | null>();

  // Blended colours per mood step, filled on first use; valid for one palette object
  let blends: (string[] | undefined)[] = [];
  let blendPalette: Palette | undefined;

  // Colours for a mood step, blended once per step instead of on every frame
  const colorsFor = (palette: Palette, step: number): string[] => {
    if (palette !== blendPalette) {
      // A different palette makes every cached colour and sprite stale
      blendPalette = palette;
      blends = [];
      sprites.clear();
    }
    let colors = blends[step];
    if (!colors) {
      colors = COLOR_KEYS.map((key) =>
        lerpColor(palette[key], palette.skyDawn, (step / MOOD_STEPS) * 0.75),
      );
      blends[step] = colors;
    }
    return colors;
  };

  // Sprite for a mood step, colour index and radius bucket, built once
  const spriteFor = (
    step: number,
    colorIdx: number,
    bucket: number,
    color: string,
  ): HTMLCanvasElement | null => {
    const key = (step * COLOR_KEYS.length + colorIdx) * RADIUS_BUCKETS.length + bucket;
    if (sprites.has(key)) {
      return sprites.get(key) ?? null;
    }
    if (sprites.size >= MAX_CACHED_SPRITES) {
      sprites.clear();
    }
    const sprite = makeSprite(color, RADIUS_BUCKETS[bucket]);
    sprites.set(key, sprite);
    return sprite;
  };

  return {
    resize(w: number, h: number): void {
      width = w;
      height = h;
    },

    step(dt: number): void {
      clock += clamp(dt, 0, 1);
    },

    draw(g: CanvasRenderingContext2D, frame: Frame): void {
      if (width <= 0 || height <= 0 || discs.length === 0) {
        return;
      }
      const palette: Palette = frame.palette;
      const mood = clamp(frame.mood, 0, 1);
      const step = Math.round(mood * MOOD_STEPS);
      const intensity = 1 - 0.2 * mood;
      const colors = colorsFor(palette, step);

      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const d of discs) {
        const breathe = 1 + 0.06 * Math.sin(d.breatheW * clock + d.breatheP);
        const r = d.radius * breathe;
        // Home plus Lissajous drift plus parallax shift; homes spill past the area by the
        // largest shift so a shifted layer never leaves an empty edge
        const driftX = d.ampX * Math.sin(d.wx * clock + d.phx);
        const driftY = d.ampY * Math.sin(d.wy * clock + d.phy);
        const x =
          d.fx * (width + 2 * BOKEH_PARALLAX_X) -
          BOKEH_PARALLAX_X +
          driftX +
          frame.px * d.depth * BOKEH_PARALLAX_X;
        const y =
          d.fy * (height + 2 * BOKEH_PARALLAX_Y) -
          BOKEH_PARALLAX_Y +
          driftY +
          frame.py * d.depth * BOKEH_PARALLAX_Y;
        const alpha = d.alpha * intensity * calmFactor(y);
        if (alpha <= 0.001) {
          continue;
        }

        g.globalAlpha = alpha;
        const color = colors[d.colorIdx];
        const sprite = spriteFor(step, d.colorIdx, d.bucket, color);
        if (sprite) {
          g.drawImage(sprite, x - r, y - r, r * 2, r * 2);
        } else {
          // No offscreen canvas available: paint the same gradient directly
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          addDiscStops(grad, color);
          g.fillStyle = grad;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    },

    dispose(): void {
      discs = [];
      sprites = new Map();
      blends = [];
      blendPalette = undefined;
    },
  };
};

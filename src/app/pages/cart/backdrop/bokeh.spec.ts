import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Budget, Frame, Palette } from './backdrop-scene';
import { lerpColor, mulberry32 } from './backdrop-kit';
import {
  BOKEH_MAX_DRIFT,
  BOKEH_MIN_DEPTH,
  BOKEH_PARALLAX_X,
  BOKEH_PARALLAX_Y,
  bokehScene,
} from './bokeh';

// The real blend, wrapped so a test can count how often a frame recomputes colours
vi.mock('./backdrop-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./backdrop-kit')>();
  return { ...actual, lerpColor: vi.fn(actual.lerpColor) };
});

const PALETTE: Palette = {
  amber: '#f0a500',
  apron: '#c8312b',
  sun: '#f4c26b',
  sunSet: '#e8865a',
  skyDawn: '#b8ccd5',
};

const DESKTOP: Budget = { scale: 1, dpr: 1, lowPower: false };

function frameOf(mood = 0, px = 0, py = 0): Frame {
  return { px, py, mood, palette: PALETTE, time: 0 };
}

interface Drawn {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  op: string;
}

// Fake main context that records every drawImage with the alpha and blend mode in force
function makeCtx(): { ctx: CanvasRenderingContext2D; drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const fake: {
    globalAlpha: number;
    globalCompositeOperation: string;
    fillStyle: unknown;
    [method: string]: unknown;
  } = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn((_img: unknown, x: number, y: number, w: number, h: number) => {
      drawn.push({
        x,
        y,
        w,
        h,
        alpha: fake.globalAlpha,
        op: fake.globalCompositeOperation,
      });
    }),
  };
  return { ctx: fake as unknown as CanvasRenderingContext2D, drawn };
}

// Centre of a recorded disc
function centre(d: Drawn): { x: number; y: number } {
  return { x: d.x + d.w / 2, y: d.y + d.h / 2 };
}

// Mean (blue - red) of the colors given to sprite gradients
function coolness(stops: string[]): number {
  let sum = 0;
  for (const s of stops) {
    const m = s.match(/(\d+), (\d+), (\d+)/);
    if (m) {
      sum += Number(m[3]) - Number(m[1]);
    }
  }
  return sum / stops.length;
}

describe('bokehScene', () => {
  let stops: string[];
  let createElement: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Offscreen sprite canvases are faked so their gradient colors can be recorded
    stops = [];
    vi.mocked(lerpColor).mockClear();
    const spriteCtx = {
      fillStyle: '' as unknown,
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn((_offset: number, color: string) => {
          stops.push(color);
        }),
      })),
    };
    createElement = vi.fn(() => ({ width: 0, height: 0, getContext: () => spriteCtx }));
    vi.stubGlobal('document', { createElement });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Draws one frame of a fresh scene and returns the recorded discs
  function firstFrame(
    budget: Budget,
    seed: number,
    frame = frameOf(),
    w = 1200,
    h = 800,
  ): Drawn[] {
    const scene = bokehScene(budget, mulberry32(seed));
    scene.resize(w, h);
    const { ctx, drawn } = makeCtx();
    scene.draw(ctx, frame);
    return drawn;
  }

  it('draws 18 discs on desktop at full scale', () => {
    // Count is the number of drawImage calls
    expect(firstFrame(DESKTOP, 1)).toHaveLength(18);
  });

  it('scales the count down but respects the minimum', () => {
    // 18 * 0.4 rounds to 7
    expect(firstFrame({ ...DESKTOP, scale: 0.4 }, 1)).toHaveLength(7);
    // Phone-class 10 * 0.4 would be 4, so the floor of 6 applies
    expect(firstFrame({ scale: 0.4, dpr: 1, lowPower: true }, 1)).toHaveLength(6);
    // Phone-class at full scale
    expect(firstFrame({ scale: 1, dpr: 1, lowPower: true }, 1)).toHaveLength(10);
  });

  it('keeps disc radii in range and blends additively', () => {
    // Breathing is at most 6 percent either way
    for (const d of firstFrame(DESKTOP, 2)) {
      expect(d.w / 2).toBeGreaterThanOrEqual(30 * 0.94 - 1e-6);
      expect(d.w / 2).toBeLessThanOrEqual(140 * 1.06 + 1e-6);
      expect(d.op).toBe('lighter');
      expect(d.alpha).toBeGreaterThan(0);
      expect(d.alpha).toBeLessThanOrEqual(0.18);
    }
  });

  it('keeps discs near their homes over many steps', () => {
    const scene = bokehScene(DESKTOP, mulberry32(3));
    scene.resize(1200, 800);
    const start = makeCtx();
    scene.draw(start.ctx, frameOf());

    // Ten minutes of simulated time at 20 fps
    for (let i = 0; i < 12000; i++) {
      scene.step(0.05, frameOf());
    }
    const end = makeCtx();
    scene.draw(end.ctx, frameOf());

    // Each axis moves at most 2 * max drift between any two moments
    const limit = 2 * BOKEH_MAX_DRIFT * Math.SQRT2 + 1;
    let moved = false;
    start.drawn.forEach((d, i) => {
      const a = centre(d);
      const b = centre(end.drawn[i]);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(limit);
      moved = moved || Math.hypot(a.x - b.x, a.y - b.y) > 0.5;
    });
    expect(moved).toBe(true);
  });

  it('draws without throwing after resize and after steps', () => {
    const scene = bokehScene(DESKTOP, mulberry32(4));
    const { ctx } = makeCtx();
    scene.resize(900, 600);
    // Static frame with no step
    expect(() => scene.draw(ctx, frameOf())).not.toThrow();
    for (let i = 0; i < 100; i++) {
      scene.step(0.016, frameOf());
    }
    expect(() => scene.draw(ctx, frameOf(0.5, 0.4, -0.4))).not.toThrow();
    // Resizing keeps working
    scene.resize(400, 800);
    expect(() => scene.draw(ctx, frameOf())).not.toThrow();
  });

  it('draws nothing before the first resize', () => {
    const scene = bokehScene(DESKTOP, mulberry32(4));
    const { ctx, drawn } = makeCtx();
    scene.draw(ctx, frameOf());
    expect(drawn).toHaveLength(0);
  });

  it('keeps home proportions when the area is resized', () => {
    const small = firstFrame(DESKTOP, 5, frameOf(), 600, 400);
    const big = firstFrame(DESKTOP, 5, frameOf(), 1200, 800);
    // A wider area spreads the same homes further apart
    const spread = (list: Drawn[]): number => {
      const xs = list.map((d) => centre(d).x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(big)).toBeGreaterThan(spread(small));
  });

  it('produces cooler colors at mood 1 than at mood 0', () => {
    firstFrame(DESKTOP, 6, frameOf(0));
    const warm = coolness(stops);
    stops.length = 0;
    firstFrame(DESKTOP, 6, frameOf(1));
    const cool = coolness(stops);
    expect(stops.length).toBeGreaterThan(0);
    expect(cool).toBeGreaterThan(warm);
  });

  it('blends colours and builds sprites only when the mood step changes', () => {
    const scene = bokehScene(DESKTOP, mulberry32(9));
    scene.resize(1200, 800);
    const { ctx } = makeCtx();
    const blend = vi.mocked(lerpColor);

    // First frame blends the four palette colours once
    scene.draw(ctx, frameOf(0));
    expect(blend).toHaveBeenCalledTimes(4);
    const sprites = createElement.mock.calls.length;
    expect(sprites).toBeGreaterThan(0);

    // Same step, even with a slightly different mood: nothing is rebuilt
    scene.draw(ctx, frameOf(0));
    scene.draw(ctx, frameOf(0.03));
    expect(blend).toHaveBeenCalledTimes(4);
    expect(createElement).toHaveBeenCalledTimes(sprites);

    // A new step blends again, and returning to a seen step reuses its colours and sprites
    scene.draw(ctx, frameOf(0.5));
    expect(blend).toHaveBeenCalledTimes(8);
    const afterCool = createElement.mock.calls.length;
    scene.draw(ctx, frameOf(0));
    scene.draw(ctx, frameOf(0.5));
    expect(blend).toHaveBeenCalledTimes(8);
    expect(createElement).toHaveBeenCalledTimes(afterCool);
  });

  it('lowers intensity as the mood gets cooler', () => {
    // Constant rand puts every disc at the same spot with the same alpha
    const flat = (mood: number): number => {
      const scene = bokehScene(DESKTOP, () => 0.5);
      scene.resize(800, 1400);
      const { ctx, drawn } = makeCtx();
      scene.draw(ctx, frameOf(mood));
      return drawn[0].alpha;
    };
    expect(flat(1) / flat(0)).toBeCloseTo(0.8, 5);
  });

  it('dims the top area compared with the middle', () => {
    // Constant rand puts the disc at half the height: 100 px (calm band) vs 700 px
    const alphaAt = (height: number): number => {
      const scene = bokehScene(DESKTOP, () => 0.5);
      scene.resize(800, height);
      const { ctx, drawn } = makeCtx();
      scene.draw(ctx, frameOf());
      return drawn[0].alpha;
    };
    const top = alphaAt(200);
    const mid = alphaAt(1400);
    expect(top).toBeLessThan(mid);
    expect(top / mid).toBeCloseTo(0.35, 3);
  });

  it('shifts discs with parallax, more for smaller discs', () => {
    const still = firstFrame(DESKTOP, 7, frameOf(0, 0, 0));
    const shifted = firstFrame(DESKTOP, 7, frameOf(0, 1, 1));
    still.forEach((d, i) => {
      const dx = centre(shifted[i]).x - centre(d).x;
      const dy = centre(shifted[i]).y - centre(d).y;
      // Depth runs 0.15..1, so the shift is within 9..60 px and 6.3..42 px
      expect(dx).toBeGreaterThanOrEqual(BOKEH_PARALLAX_X * BOKEH_MIN_DEPTH - 1e-6);
      expect(dx).toBeLessThanOrEqual(BOKEH_PARALLAX_X + 1e-6);
      expect(dy).toBeGreaterThanOrEqual(BOKEH_PARALLAX_Y * BOKEH_MIN_DEPTH - 1e-6);
      expect(dy).toBeLessThanOrEqual(BOKEH_PARALLAX_Y + 1e-6);
    });
  });

  it('separates the layers: the nearest and farthest discs shift by clearly different amounts', () => {
    const still = firstFrame(DESKTOP, 11, frameOf(0, 0, 0));
    const shifted = firstFrame(DESKTOP, 11, frameOf(0, 1, 0));
    const shifts = still.map((d, i) => centre(shifted[i]).x - centre(d).x);
    // Nearest layer moves several times as far as the farthest one
    expect(Math.max(...shifts)).toBeGreaterThan(Math.min(...shifts) * 3);
    expect(Math.max(...shifts)).toBeGreaterThan(40);
  });

  it('moves the other way for a negative pointer position', () => {
    const still = firstFrame(DESKTOP, 7, frameOf(0, 0, 0));
    const shifted = firstFrame(DESKTOP, 7, frameOf(0, -1, -1));
    still.forEach((d, i) => {
      expect(centre(shifted[i]).x).toBeLessThan(centre(d).x);
      expect(centre(shifted[i]).y).toBeLessThan(centre(d).y);
    });
  });

  it('spreads homes past the area by the largest shift so shifted layers leave no empty edge', () => {
    const at = (r: number, px: number): { x: number; y: number } => {
      const scene = bokehScene(DESKTOP, () => r);
      scene.resize(1200, 800);
      const { ctx, drawn } = makeCtx();
      scene.draw(ctx, frameOf(0, px, 0));
      return centre(drawn[0]);
    };
    // Smallest disc (depth 1) at fx = 0 starts one full shift left of the area
    expect(at(0, 0).x).toBeCloseTo(-BOKEH_PARALLAX_X, 5);
    expect(at(0, 0).y).toBeCloseTo(-BOKEH_PARALLAX_Y, 5);
    // The same disc slides to the area's edge when the pointer is fully right
    expect(at(0, 1).x).toBeCloseTo(0, 5);
    // And fx = 1 starts one full shift past the right edge
    expect(at(1, 0).x).toBeCloseTo(1200 + BOKEH_PARALLAX_X, 5);
  });

  it('does not throw on dispose and stays safe to draw afterwards', () => {
    const scene = bokehScene(DESKTOP, mulberry32(8));
    scene.resize(800, 600);
    const { ctx } = makeCtx();
    scene.draw(ctx, frameOf());
    expect(() => scene.dispose()).not.toThrow();
    expect(() => scene.draw(ctx, frameOf())).not.toThrow();
  });

  it('gives the same first frame for the same seed', () => {
    const a = firstFrame(DESKTOP, 42);
    const b = firstFrame(DESKTOP, 42);
    // A different seed lays the discs out differently
    const c = firstFrame(DESKTOP, 43);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

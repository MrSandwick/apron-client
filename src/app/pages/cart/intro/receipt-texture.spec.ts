import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardTexture, cutPaperShape, isTransparent, textureScale } from './receipt-texture';

type Style = Record<string, string>;

const INK = 'rgb(28, 36, 51)';
const PAPER = 'rgb(246, 237, 226)';
const SVG_NS = 'http://www.w3.org/2000/svg';

// What getComputedStyle reports for a plain block with no box and no border
const DEFAULT_STYLE: Style = {
  display: 'block',
  visibility: 'visible',
  opacity: '1',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  color: INK,
  fontSize: '16px',
  fontWeight: '400',
  fontStyle: 'normal',
  fontFamily: 'Nunito, sans-serif',
  letterSpacing: 'normal',
  textTransform: 'none',
  clip: 'auto',
  clipPath: 'none',
  borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px',
  borderBottomRightRadius: '0px',
  borderBottomLeftRadius: '0px',
  ...Object.fromEntries(
    ['Top', 'Right', 'Bottom', 'Left'].flatMap((side) => [
      [`border${side}Width`, '0px'],
      [`border${side}Style`, 'none'],
      [`border${side}Color`, 'rgb(0, 0, 0)'],
    ]),
  ),
};

// jsdom has no layout, so styles, element rects and per-word text rects are all supplied
const styles = new WeakMap<Element, Style>();
const layouts = new WeakMap<Text, (start: number, end: number) => DOMRect>();

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height }) as DOMRect;

// An element with a fixed rect and computed style; children follow in order
function box(
  tag: string,
  at: [number, number, number, number],
  style: Style = {},
  ...children: Node[]
): HTMLElement {
  const el = document.createElement(tag);
  const r = rect(...at);
  el.getBoundingClientRect = () => r;
  styles.set(el, style);
  el.append(...children);
  return el;
}

// Text on one line starting at (x, y); every character is 10 px wide
function words(content: string, x: number, y: number, height = 20): Text {
  const node = document.createTextNode(content);
  layouts.set(node, (start, end) => rect(x + start * 10, y, (end - start) * 10, height));
  return node;
}

// Fake 2D context that records what was filled, stroked and written, with the state at that moment
function fakeContext() {
  let path: number[][] = [];
  let dash: number[] = [];
  const log = {
    fills: [] as { style: string; alpha: number; path: number[][]; op: string }[],
    strokes: [] as { style: string; width: number; dash: number[]; path: number[][] }[],
    texts: [] as {
      text: string;
      x: number;
      y: number;
      font: string;
      fill: string;
      alpha: number;
      spacing: string;
    }[],
  };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    globalCompositeOperation: '',
    letterSpacing: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(() => {
      path = [];
    }),
    moveTo: vi.fn((x: number, y: number) => {
      path.push([x, y]);
    }),
    lineTo: vi.fn((x: number, y: number) => {
      path.push([x, y]);
    }),
    ellipse: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn((d: number[]) => {
      dash = d;
    }),
    fill: vi.fn(() => {
      log.fills.push({
        style: ctx.fillStyle,
        alpha: ctx.globalAlpha,
        path: [...path],
        op: ctx.globalCompositeOperation,
      });
    }),
    stroke: vi.fn(() => {
      log.strokes.push({
        style: ctx.strokeStyle,
        width: ctx.lineWidth,
        dash: [...dash],
        path: [...path],
      });
    }),
    // Font metrics: 16 above the baseline and 4 below, 20 in all
    measureText: vi.fn(() => ({ width: 0, fontBoundingBoxAscent: 16, fontBoundingBoxDescent: 4 })),
    fillText: vi.fn((text: string, x: number, y: number) => {
      log.texts.push({
        text,
        x,
        y,
        font: ctx.font,
        fill: ctx.fillStyle,
        alpha: ctx.globalAlpha,
        spacing: ctx.letterSpacing,
      });
    }),
  };
  return { ctx, log };
}

function useContext(ctx: unknown): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
}

const CARD_AT: [number, number, number, number] = [10, 20, 400, 500];

// The torn edge hangs 11 px below the card, so the union is 400 x 511 at (10, 20)
const edgeEl = () => box('div', [10, 519, 400, 12]);

const drawnTexts = (log: ReturnType<typeof fakeContext>['log']) => log.texts.map((t) => t.text);

describe('textureScale', () => {
  // Two texture pixels per CSS pixel while the card fits
  it('is 2 for a card that fits the texture limit', () => {
    expect(textureScale(511, 400)).toBe(2);
  });

  // A tall union or a wide card pulls the scale down so no side passes 2048
  it('shrinks so the union height and the card width stay within 2048', () => {
    expect(textureScale(4096, 400)).toBe(0.5);
    expect(textureScale(1000, 4096)).toBe(0.5);
  });
});

describe('isTransparent', () => {
  // Every spelling of "no colour" a computed style can return
  it.each([
    'transparent',
    '',
    'rgba(0, 0, 0, 0)',
    'rgba(255, 255, 255, 0.0)',
    'color(srgb 1 1 1 / 0)',
    'oklab(0.5 0 0 / 0%)',
  ])('treats %j as transparent', (color) => {
    expect(isTransparent(color)).toBe(true);
  });

  it.each(['rgb(0, 0, 0)', 'rgba(255, 255, 255, 0.6)', 'color(srgb 1 1 1 / 0.6)', '#f6ede2'])(
    'treats %j as a colour',
    (color) => {
      expect(isTransparent(color)).toBe(false);
    },
  );
});

describe('cutPaperShape', () => {
  // The 24px card radius is scaled by texture width over card width
  it.each([
    { cssWidth: 512, radius: 24 },
    { cssWidth: 256, radius: 48 },
    { cssWidth: 1024, radius: 12 },
  ])(
    'rounds the top corners to $radius texture px for a $cssWidth px card',
    ({ cssWidth, radius }) => {
      const { ctx } = fakeContext();
      cutPaperShape(ctx as unknown as CanvasRenderingContext2D, 512, 1024, cssWidth);
      // Left corner centre at (r, r), right corner centre at (width - r, r)
      expect(ctx.arc.mock.calls[0].slice(0, 3)).toEqual([radius, radius, radius]);
      expect(ctx.arc.mock.calls[1].slice(0, 3)).toEqual([512 - radius, radius, radius]);
      expect(ctx.globalCompositeOperation).toBe('destination-out');
    },
  );

  // The 12px triangles with a 12px period are scaled the same way, tips on the bottom edge
  it('draws the tear as 12 css px triangles at the card scale', () => {
    const { ctx } = fakeContext();
    // Scale 2: teeth are 24 texture px tall and wide
    cutPaperShape(ctx as unknown as CanvasRenderingContext2D, 512, 1024, 256);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 1024 - 24);
    expect(ctx.lineTo).toHaveBeenCalledWith(12, 1024);
    expect(ctx.lineTo).toHaveBeenCalledWith(24, 1024 - 24);
    expect(ctx.lineTo).toHaveBeenCalledWith(36, 1024);
  });

  // Without a measured card the 576px max-w-xl width is assumed
  it('assumes a 576 css px card by default', () => {
    const { ctx } = fakeContext();
    cutPaperShape(ctx as unknown as CanvasRenderingContext2D, 576, 1000);
    expect(ctx.arc.mock.calls[0].slice(0, 3)).toEqual([24, 24, 24]);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 1000 - 12);
  });
});

describe('createCardTexture', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((el: Element) => ({
      ...DEFAULT_STYLE,
      ...(styles.get(el) ?? {}),
    })) as never);
    // jsdom's Range has no layout; the word's rect comes from its text node's layout function
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value(this: Range) {
        const layout = layouts.get(this.startContainer as Text);
        return layout ? [layout(this.startOffset, this.endOffset)] : [];
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
    Reflect.deleteProperty(document, 'fonts');
  });

  function setFonts(value: unknown): void {
    Object.defineProperty(document, 'fonts', { value, configurable: true });
  }

  // A card with static text and boxes, plus every kind of part that must stay off the ticket
  function buildCard() {
    const legend = box(
      'legend',
      [20, 40, 300, 24],
      { fontWeight: '700' },
      words('How would you like your order?', 20, 40, 24),
    );
    // Inline custom-element host whose own rect is a sliver, as around block children
    const host = box('app-fulfillment-toggle', [0, 0, 0, 0], { display: 'inline' }, legend);

    const lines = box(
      'ul',
      [20, 100, 360, 120],
      { backgroundColor: 'rgb(10, 10, 10)' },
      box('li', [20, 100, 360, 60], {}, words('Bulgogi', 20, 100)),
    );
    lines.setAttribute('data-intro-dynamic', '');

    const total = box('dd', [300, 240, 80, 24], {}, words('$44', 300, 240));
    total.setAttribute('data-intro-dynamic', '');

    const divider = box('div', [30, 300, 360, 2], {
      borderTopWidth: '2px',
      borderTopStyle: 'dashed',
      borderTopColor: INK,
    });

    const input = box('input', [30, 350, 300, 44], {
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
      borderTopStyle: 'solid',
      borderRightStyle: 'solid',
      borderBottomStyle: 'solid',
      borderLeftStyle: 'solid',
      borderTopColor: 'rgba(28, 36, 51, 0.3)',
      borderRightColor: 'rgba(28, 36, 51, 0.3)',
      borderBottomColor: 'rgba(28, 36, 51, 0.3)',
      borderLeftColor: 'rgba(28, 36, 51, 0.3)',
      borderTopLeftRadius: '9999px',
      borderTopRightRadius: '9999px',
      borderBottomRightRadius: '9999px',
      borderBottomLeftRadius: '9999px',
    });

    const checkout = box(
      'button',
      [30, 400, 360, 44],
      {
        backgroundColor: INK,
        color: PAPER,
        opacity: '0.5',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderTopLeftRadius: '9999px',
        borderTopRightRadius: '9999px',
        borderBottomRightRadius: '9999px',
        borderBottomLeftRadius: '9999px',
      },
      words('Checkout', 150, 411, 22),
    );

    // Parts that must not reach the ticket
    const srOnly = box('h2', [0, 0, 1, 1], {}, words('Items', 0, 0, 1));
    const clipped = box(
      'span',
      [0, 0, 50, 20],
      { clip: 'rect(0px, 0px, 0px, 0px)' },
      words('Radio', 0, 0),
    );
    const icon = document.createElementNS(SVG_NS, 'svg');
    icon.append(document.createTextNode('Icon title'));
    const mascot = box('app-ahjoomah-face', [330, 20, 56, 56], {}, words('Face', 330, 20));
    const gone = box('p', [20, 460, 100, 20], { display: 'none' }, words('Gone', 20, 460));
    const invisible = box(
      'p',
      [20, 480, 200, 20],
      { visibility: 'hidden' },
      words('Ghost', 20, 480),
      // A child may turn visibility back on
      box('span', [120, 480, 40, 20], { visibility: 'visible' }, words('Seen', 120, 480)),
    );
    const faded = box('p', [20, 500, 100, 20], { opacity: '0' }, words('Faded', 20, 500));

    const card = box(
      'div',
      CARD_AT,
      { backgroundColor: PAPER },
      host,
      lines,
      total,
      divider,
      input,
      checkout,
      srOnly,
      clipped,
      icon,
      mascot,
      gone,
      invisible,
      faded,
    );
    card.setAttribute('data-intro-target', '');
    return card;
  }

  async function draw(card: HTMLElement = buildCard(), edge: HTMLElement | null = edgeEl()) {
    setFonts(undefined);
    const fake = fakeContext();
    useContext(fake.ctx);
    const texture = await createCardTexture(card, edge);
    return { ...fake, texture };
  }

  // The canvas covers the card and its torn edge at two pixels per CSS pixel
  it('sizes the canvas from the card joined with its edge, at 2 px per css px', async () => {
    const { texture } = await draw();
    expect(texture.canvas.width).toBe(800);
    expect(texture.canvas.height).toBe(1022);
    expect(texture.aspect).toBeCloseTo(511 / 400);
  });

  // A tall card is drawn smaller so the height stays within 2048
  it('lowers the scale for a very tall card', async () => {
    const tall = box('div', [0, 0, 400, 3000], { backgroundColor: PAPER });
    const edge = box('div', [0, 2999, 400, 12]);
    const { texture } = await draw(tall, edge);
    expect(texture.canvas.height).toBe(2048);
    expect(texture.canvas.width).toBe(Math.round((400 * 2048) / 3011));
    expect(texture.aspect).toBeCloseTo(3011 / 400);
  });

  // Without an edge the card alone sets the size
  it('uses the card alone when there is no torn edge', async () => {
    const { texture } = await draw(buildCard(), null);
    expect(texture.canvas.height).toBe(1000);
    expect(texture.aspect).toBeCloseTo(500 / 400);
  });

  // The sheet is the card's own colour, and the corners and tear are cut last
  it('fills the sheet with the card colour and cuts the silhouette last', async () => {
    const { ctx } = await draw();
    // The sheet covers the whole canvas
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 1022);
    expect(ctx.globalCompositeOperation).toBe('destination-out');
    // 24 css px corners at 2 px per css px
    expect(ctx.arc.mock.calls[0].slice(0, 3)).toEqual([48, 48, 48]);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 1022 - 24);
  });

  // Static text reaches the ticket at its laid-out position with the computed font and colour
  it('draws static text where the layout put it, in the computed font and colour', async () => {
    const { log } = await draw();
    const legend = log.texts.find((t) => t.text === 'How would you like your order?')!;
    expect(legend).toBeDefined();
    // Left edge: (20 - 10) * 2, in a font scaled to 32px
    expect(legend.x).toBe(20);
    expect(legend.font).toBe('normal 700 32px Nunito, sans-serif');
    expect(legend.fill).toBe(INK);
    // Baseline: line top 40 plus half the 28 spare px (48 tall rect, 20 of font) plus the 16 ascent
    expect(legend.y).toBe(70);
    expect(legend.alpha).toBe(1);
  });

  // Dynamic content, the mascot, icons, sr-only text and hidden elements leave their space blank
  it('leaves out dynamic parts, the mascot, icons, sr-only, clipped and hidden elements', async () => {
    const { log } = await draw();
    const texts = drawnTexts(log);
    for (const absent of [
      'Bulgogi',
      '$44',
      'Items',
      'Radio',
      'Icon',
      'Face',
      'Gone',
      'Ghost',
      'Faded',
    ]) {
      expect(texts.some((t) => t.includes(absent))).toBe(false);
    }
    // The dynamic list's own background is not painted either
    expect(log.fills.some((f) => f.style === 'rgb(10, 10, 10)')).toBe(false);
    // A visible child of a hidden parent still shows
    expect(texts).toContain('Seen');
  });

  // The sliver-sized inline host does not hide the toggle inside it
  it('keeps the children of an inline host with a collapsed rect', async () => {
    const { log } = await draw();
    expect(drawnTexts(log)).toContain('How would you like your order?');
  });

  // A paragraph that wraps becomes one fillText per rendered line
  it('splits wrapped text into its line boxes, each from its first word', async () => {
    const node = document.createTextNode('Hello big world');
    // The third word wraps onto a second line 20 px lower
    layouts.set(node, (start, end) =>
      start < 10
        ? rect(20 + start * 10, 100, (end - start) * 10, 20)
        : rect(20 + (start - 10) * 10, 120, (end - start) * 10, 20),
    );
    const card = box(
      'div',
      CARD_AT,
      { backgroundColor: PAPER },
      box('p', [20, 100, 100, 40], {}, node),
    );
    const { log } = await draw(card);
    expect(log.texts.map((t) => [t.text, t.x, t.y])).toEqual([
      // Line top (100 - 20) * 2 = 160, 20 spare px split in two, 16 ascent
      ['Hello big', 20, 186],
      // Second line starts back at the left, one 20 css px line lower
      ['world', 20, 226],
    ]);
  });

  // The text-transform and letter-spacing of the element apply, and its opacity fades the text
  it('applies text-transform, letter-spacing and the element opacity to text', async () => {
    const { log } = await draw();
    const checkout = log.texts.find((t) => t.text === 'CHECKOUT')!;
    expect(checkout).toBeDefined();
    expect(checkout.spacing).toBe('2px');
    expect(checkout.alpha).toBe(0.5);
    expect(checkout.fill).toBe(PAPER);
  });

  // A box with a background becomes a rounded rectangle at its rect, faded by its opacity
  it('paints a background as a rounded rect from the computed radii', async () => {
    const { log } = await draw();
    const button = log.fills.find((f) => f.style === INK)!;
    expect(button).toBeDefined();
    expect(button.alpha).toBe(0.5);
    // rounded-full on a 44px tall box: 22 css px radius, so 44 texture px; starts after the corner
    expect(button.path[0][0]).toBeCloseTo((30 - 10) * 2 + 44, 5);
    expect(button.path[0][1]).toBe((400 - 20) * 2);
    // The translucent input fill keeps its alpha in the colour
    expect(log.fills.some((f) => f.style === 'rgba(255, 255, 255, 0.6)')).toBe(true);
  });

  // Equal borders on all sides are one rounded outline, inset by half the width
  it('strokes uniform borders as one solid outline', async () => {
    const { log } = await draw();
    const outline = log.strokes.find((s) => s.style === 'rgba(28, 36, 51, 0.3)')!;
    expect(outline).toBeDefined();
    expect(outline.width).toBe(2);
    expect(outline.dash).toEqual([]);
  });

  // A one-sided dashed border becomes a dashed line along that edge, with the browser's dash ratio
  it('draws a dashed top border as a dashed line along the top edge', async () => {
    const { log } = await draw();
    const rule = log.strokes.find((s) => s.dash.length > 0)!;
    expect(rule).toBeDefined();
    // 2 css px wide: 4 texture px, dashes 3 widths long with 2 widths between
    expect(rule.width).toBe(4);
    expect(rule.dash).toEqual([12, 8]);
    // Centred in the border: 560 + 2, from x 40 across 360 css px
    expect(rule.path).toEqual([
      [40, 562],
      [760, 562],
    ]);
    expect(rule.style).toBe(INK);
  });

  // No 2D context: the empty canvas comes back instead of an error
  it('returns the empty canvas when getContext is null', async () => {
    setFonts(undefined);
    useContext(null);
    const texture = await createCardTexture(buildCard(), edgeEl());
    expect(texture.canvas.width).toBe(800);
    expect(texture.aspect).toBeCloseTo(511 / 400);
  });

  // A card that has no size cannot be copied
  it('rejects when the card has no size', async () => {
    setFonts(undefined);
    useContext(fakeContext().ctx);
    const empty = box('div', [0, 0, 0, 0]);
    await expect(createCardTexture(empty, null)).rejects.toThrow('no size');
  });

  // Paper falls back to the theme colour when the card has no background of its own
  it('falls back to the theme paper colour for a transparent card', async () => {
    setFonts(undefined);
    const { ctx } = fakeContext();
    const sheets: string[] = [];
    ctx.fillRect.mockImplementation(() => {
      sheets.push(ctx.fillStyle);
    });
    useContext(ctx);
    await createCardTexture(box('div', CARD_AT), null);
    expect(sheets).toEqual(['#f6ede2']);
  });

  // The document's fonts and the card's running animations are awaited before drawing
  it('waits for document fonts and card animations', async () => {
    let resolveFonts: (value?: unknown) => void = () => undefined;
    setFonts({ ready: new Promise((resolve) => (resolveFonts = resolve)) });
    useContext(fakeContext().ctx);
    const card = buildCard();
    const getAnimations = vi.fn(() => [{ finished: Promise.resolve() }]);
    Object.defineProperty(card, 'getAnimations', { value: getAnimations });

    let done = false;
    const pending = createCardTexture(card, edgeEl()).then(() => {
      done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Fonts are still loading, so nothing is drawn yet
    expect(done).toBe(false);
    resolveFonts();
    await pending;
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    expect(done).toBe(true);
  });

  // A font that never arrives only delays the texture by the short cap
  it('stops waiting for fonts after the cap', async () => {
    setFonts({ ready: new Promise(() => undefined) });
    useContext(null);
    const started = Date.now();
    const texture = await createCardTexture(buildCard(), edgeEl());
    expect(texture.canvas.width).toBe(800);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // A failing font load is treated like a missing font
  it('survives a rejected fonts.ready', async () => {
    setFonts({ ready: Promise.reject(new Error('no font')) });
    useContext(null);
    await expect(createCardTexture(buildCard(), edgeEl())).resolves.toBeDefined();
  });
});

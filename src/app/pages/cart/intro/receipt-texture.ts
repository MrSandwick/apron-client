import { unionRect } from './card-rect';

// The ticket artwork for the printer intro: a picture of the real receipt card, drawn by walking
// its laid-out DOM. Plain TypeScript, no Angular.

export interface CardTexture {
  canvas: HTMLCanvasElement;
  // Ticket height over width, from the card joined with its torn edge
  aspect: number;
}

// Texture pixels per CSS pixel, capped here and by the largest texture side
const MAX_SCALE = 2;
const MAX_TEXTURE = 2048;
// Fonts and running animations get this long to settle, so a slow font cannot stall the intro
const SETTLE_MS = 300;
// The DOM card the ticket lands on, in CSS pixels: rounded-t-3xl corners, a 12px torn edge with a
// 12px period, and max-w-xl wide when nothing was measured
const CORNER_CSS = 24;
const TEAR_CSS = 12;
const DEFAULT_CSS_WIDTH = 576;
// Paper colour when the card's own background cannot be read
const FALLBACK_PAPER = '#f6ede2';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Parts that are drawn by the 2D page after the hand-off, or never: dynamic content and the mascot
const SKIP_SELECTOR = '[data-intro-dynamic], app-ahjoomah-face, [data-testid="cart-mascot"]';

// Position of the texture in the viewport (CSS px) and its pixels per CSS pixel
interface Frame {
  left: number;
  top: number;
  k: number;
}

type Radius = [number, number];

interface BorderSide {
  width: number;
  style: string;
  color: string;
}

// Cuts the card silhouette out of the alpha: rounded top corners and the zigzag bottom edge, both
// scaled from CSS pixels by texture width over card width so they match the DOM shapes
export function cutPaperShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cssWidth = DEFAULT_CSS_WIDTH,
): void {
  const scale = width / cssWidth;
  const radius = CORNER_CSS * scale;
  const tooth = TEAR_CSS * scale;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';

  // Top corners: the square corner minus the quarter disc that stays
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius, 0);
  ctx.arc(radius, radius, radius, -Math.PI / 2, Math.PI, true);
  ctx.closePath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width - radius, 0);
  ctx.arc(width - radius, radius, radius, -Math.PI / 2, 0, false);
  ctx.closePath();
  ctx.fill();

  // Torn edge: everything under a row of downward triangles, base on top, tip at the bottom
  ctx.beginPath();
  ctx.moveTo(0, height - tooth);
  let x = 0;
  while (x < width) {
    ctx.lineTo(x + tooth / 2, height);
    ctx.lineTo(x + tooth, height - tooth);
    x += tooth;
  }
  ctx.lineTo(x, height + tooth);
  ctx.lineTo(0, height + tooth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Texture pixels per CSS pixel: 2 at most, and small enough for the union and the card width
// to stay within the largest texture side
export function textureScale(unionHeight: number, cardWidth: number): number {
  return Math.min(MAX_SCALE, MAX_TEXTURE / unionHeight, MAX_TEXTURE / cardWidth);
}

// True for a colour with no opacity: the keyword, rgba(.., 0) or any `/ 0` alpha form
export function isTransparent(color: string): boolean {
  const value = color.trim().toLowerCase();
  if (value === '' || value === 'transparent') return true;
  const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(value);
  if (slash) return parseFloat(slash[1]) === 0;
  const legacy = /^rgba\(([^)]*)\)$/.exec(value);
  if (legacy) {
    const parts = legacy[1].split(',');
    return parts.length === 4 && parseFloat(parts[3]) === 0;
  }
  return false;
}

// Waits for the document's fonts and any running animation or transition on the card, but never
// longer than SETTLE_MS
async function settled(card: HTMLElement): Promise<void> {
  const noop = (): undefined => undefined;
  const waits: Promise<unknown>[] = [];
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (fonts?.ready) waits.push(Promise.resolve(fonts.ready).then(noop, noop));
  if (typeof card.getAnimations === 'function') {
    for (const animation of card.getAnimations({ subtree: true })) {
      waits.push(animation.finished.then(noop, noop));
    }
  }
  if (waits.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SETTLE_MS);
  });
  await Promise.race([Promise.all(waits), timeout]);
  clearTimeout(timer);
}

// Screen-reader-only text (sr-only) and anything collapsed to a point
function isVisuallyHidden(style: CSSStyleDeclaration, rect: DOMRect): boolean {
  const clip = String(style.clip ?? '');
  const clipPath = String(style.clipPath ?? '');
  if (/rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(clip)) return true;
  if (/inset\(\s*50%/.test(clipPath)) return true;
  // Inline hosts (custom elements) can report a thin rect around block children
  const inline = style.display === 'inline' || style.display === 'contents';
  return !inline && (rect.width <= 1 || rect.height <= 1);
}

// One corner of a computed border-radius: "24px", "24px 12px" or a percentage
function parseCorner(value: string, width: number, height: number): Radius {
  const parts = value.trim().split(/\s+/);
  const length = (part: string | undefined, of: number): number => {
    const n = parseFloat(part ?? '');
    if (!(n > 0)) return 0;
    return part?.endsWith('%') ? (n / 100) * of : n;
  };
  return [length(parts[0], width), length(parts[1] ?? parts[0], height)];
}

// Corner radii in CSS px, scaled down together when neighbours would overlap (as browsers do)
function cornerRadii(style: CSSStyleDeclaration, width: number, height: number): Radius[] {
  const radii = [
    parseCorner(style.borderTopLeftRadius, width, height),
    parseCorner(style.borderTopRightRadius, width, height),
    parseCorner(style.borderBottomRightRadius, width, height),
    parseCorner(style.borderBottomLeftRadius, width, height),
  ];
  const [tl, tr, br, bl] = radii;
  const ratio = (room: number, sum: number): number => (sum > 0 ? room / sum : 1);
  const f = Math.min(
    1,
    ratio(width, tl[0] + tr[0]),
    ratio(width, bl[0] + br[0]),
    ratio(height, tl[1] + bl[1]),
    ratio(height, tr[1] + br[1]),
  );
  return radii.map(([rx, ry]): Radius => [rx * f, ry * f]);
}

// Rounded rectangle path with elliptical corners, in canvas pixels
function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: Radius[],
): void {
  const [tl, tr, br, bl] = radii;
  ctx.beginPath();
  ctx.moveTo(x + tl[0], y);
  ctx.lineTo(x + w - tr[0], y);
  ctx.ellipse(x + w - tr[0], y + tr[1], tr[0], tr[1], 0, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - br[1]);
  ctx.ellipse(x + w - br[0], y + h - br[1], br[0], br[1], 0, 0, Math.PI / 2);
  ctx.lineTo(x + bl[0], y + h);
  ctx.ellipse(x + bl[0], y + h - bl[1], bl[0], bl[1], 0, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + tl[1]);
  ctx.ellipse(x + tl[0], y + tl[1], tl[0], tl[1], 0, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function borderSides(style: CSSStyleDeclaration): BorderSide[] {
  const side = (width: string, kind: string, color: string): BorderSide => ({
    width: parseFloat(width) || 0,
    style: kind,
    color,
  });
  return [
    side(style.borderTopWidth, style.borderTopStyle, style.borderTopColor),
    side(style.borderRightWidth, style.borderRightStyle, style.borderRightColor),
    side(style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor),
    side(style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor),
  ];
}

const sideVisible = (side: BorderSide): boolean =>
  side.width > 0 && side.style !== 'none' && side.style !== 'hidden' && !isTransparent(side.color);

// Colour, width and the browser's own dash pattern for a border side (thin dashes are 3:2, thick 2:1)
function setStroke(ctx: CanvasRenderingContext2D, side: BorderSide, k: number): void {
  const width = side.width * k;
  ctx.strokeStyle = side.color;
  ctx.lineWidth = width;
  if (side.style === 'dashed') {
    ctx.setLineDash(side.width < 3 ? [3 * width, 2 * width] : [2 * width, width]);
  } else if (side.style === 'dotted') {
    ctx.setLineDash([width, width]);
  } else {
    ctx.setLineDash([]);
  }
}

// Strokes the borders: one rounded outline when all four sides match, else each side as a line
function strokeBorders(
  ctx: CanvasRenderingContext2D,
  sides: BorderSide[],
  x: number,
  y: number,
  w: number,
  h: number,
  radii: Radius[],
  k: number,
): void {
  const [top, right, bottom, left] = sides;
  const uniform = sides.every(
    (s) =>
      sideVisible(s) && s.width === top.width && s.style === top.style && s.color === top.color,
  );
  if (uniform) {
    const half = (top.width * k) / 2;
    const inner = radii.map(([rx, ry]): Radius => [Math.max(0, rx - half), Math.max(0, ry - half)]);
    roundedPath(ctx, x + half, y + half, w - 2 * half, h - 2 * half, inner);
    setStroke(ctx, top, k);
    ctx.stroke();
    return;
  }
  // Each visible side runs along its own edge, centred in its width
  const segment = (side: BorderSide, x1: number, y1: number, x2: number, y2: number): void => {
    if (!sideVisible(side)) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    setStroke(ctx, side, k);
    ctx.stroke();
  };
  const t = (top.width * k) / 2;
  const r = (right.width * k) / 2;
  const b = (bottom.width * k) / 2;
  const l = (left.width * k) / 2;
  segment(top, x, y + t, x + w, y + t);
  segment(right, x + w - r, y, x + w - r, y + h);
  segment(bottom, x, y + h - b, x + w, y + h - b);
  segment(left, x + l, y, x + l, y + h);
}

// An element's own box: its background and its borders, when it has either
function paintBox(
  ctx: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  rect: DOMRect,
  frame: Frame,
  alpha: number,
): void {
  const { k } = frame;
  const sides = borderSides(style);
  const hasBackground = !isTransparent(style.backgroundColor);
  const hasBorder = sides.some(sideVisible);
  if (!hasBackground && !hasBorder) return;

  const x = (rect.x - frame.left) * k;
  const y = (rect.y - frame.top) * k;
  const w = rect.width * k;
  const h = rect.height * k;
  const radii = cornerRadii(style, rect.width, rect.height).map(
    ([rx, ry]): Radius => [rx * k, ry * k],
  );

  ctx.save();
  ctx.globalAlpha = alpha;
  if (hasBackground) {
    roundedPath(ctx, x, y, w, h, radii);
    ctx.fillStyle = style.backgroundColor;
    ctx.fill();
  }
  if (hasBorder) strokeBorders(ctx, sides, x, y, w, h, radii, k);
  ctx.restore();
}

// text-transform is applied by layout, not stored in the text node
function transformText(text: string, transform: string): string {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') {
    return text.replace(
      /(^|\s)(\S)/g,
      (_: string, gap: string, c: string) => gap + c.toUpperCase(),
    );
  }
  return text;
}

// A run of words on one line box
interface TextLine {
  words: string[];
  x: number;
  top: number;
  height: number;
}

// Splits a text node into its rendered lines by measuring one Range per word
function textLines(node: Text): TextLine[] {
  const lines: TextLine[] = [];
  const range = document.createRange();
  for (const match of node.data.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    range.setStart(node, start);
    range.setEnd(node, start + match[0].length);
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    // Words that are not rendered (clipped away, display none) have no box
    if (!rect || (rect.width === 0 && rect.height === 0)) continue;
    const last = lines[lines.length - 1];
    // Same line while the word starts within half a line height of the line's top
    if (last && Math.abs(rect.y - last.top) < last.height / 2) {
      last.words.push(match[0]);
    } else {
      lines.push({ words: [match[0]], x: rect.x, top: rect.y, height: rect.height });
    }
  }
  return lines;
}

// A text node's lines, each drawn from its first word's left edge with the computed font
function paintText(
  ctx: CanvasRenderingContext2D,
  node: Text,
  style: CSSStyleDeclaration,
  frame: Frame,
  alpha: number,
): void {
  if (!/\S/.test(node.data)) return;
  const lines = textLines(node);
  if (lines.length === 0) return;

  const { k } = frame;
  const size = (parseFloat(style.fontSize) || 16) * k;
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const letterSpacing = parseFloat(style.letterSpacing);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${style.fontStyle || 'normal'} ${style.fontWeight || '400'} ${size}px ${style.fontFamily}`;
  ctx.fillStyle = style.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in spaced) {
    spaced.letterSpacing = `${Number.isFinite(letterSpacing) ? letterSpacing * k : 0}px`;
  }
  for (const line of lines) {
    const text = transformText(line.words.join(' '), style.textTransform);
    const metrics = ctx.measureText(text);
    const ascent = metrics.fontBoundingBoxAscent ?? size * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? size * 0.2;
    // The line rect is the font's content area, so the baseline sits one ascent below its top;
    // spare height (a different fallback font) is split evenly above and below
    const spare = line.height * k - (ascent + descent);
    const baseline = (line.top - frame.top) * k + spare / 2 + ascent;
    ctx.fillText(text, (line.x - frame.left) * k, baseline);
  }
  ctx.restore();
}

// Draws an element and its subtree in document order. Dynamic parts, the mascot, SVG icons,
// screen-reader text and hidden elements are left out, so their space stays paper
function paintElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  frame: Frame,
  alpha: number,
  isRoot = false,
): void {
  if (el.namespaceURI === SVG_NS || el.matches(SKIP_SELECTOR)) return;
  const style = getComputedStyle(el);
  if (style.display === 'none') return;
  const rect = el.getBoundingClientRect();
  if (isVisuallyHidden(style, rect)) return;

  // The card's own opacity is the intro's doing, so only opacity inside it counts
  const own = isRoot ? 1 : parseFloat(style.opacity);
  const mine = alpha * (Number.isFinite(own) ? own : 1);
  if (mine <= 0) return;

  // Children may turn visibility back on, so a hidden element only skips its own painting
  const visible = style.visibility !== 'hidden';
  if (visible && !isRoot) paintBox(ctx, style, rect, frame, mine);
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) {
      paintElement(ctx, child as Element, frame, mine);
    } else if (child.nodeType === 3 && visible) {
      paintText(ctx, child as Text, style, frame, mine);
    }
  }
}

// Draws the card as it is laid out right now, minus its dynamic parts, onto a canvas the size of
// the card joined with its torn edge. The card's colour fills the sheet and the corners and the
// tear are cut from the alpha. With no 2D context the empty canvas comes back.
export async function createCardTexture(
  card: HTMLElement,
  edge: HTMLElement | null,
): Promise<CardTexture> {
  await settled(card);
  const cardRect = card.getBoundingClientRect();
  const union = unionRect(cardRect, edge?.getBoundingClientRect());
  if (!union) throw new Error('The receipt card has no size');

  const k = textureScale(union.height, cardRect.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(union.width * k));
  canvas.height = Math.max(1, Math.round(union.height * k));
  const aspect = union.height / union.width;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, aspect };

  // Paper in the card's own colour
  const paper = getComputedStyle(card).backgroundColor;
  ctx.fillStyle = isTransparent(paper) ? FALLBACK_PAPER : paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  paintElement(ctx, card, { left: union.x, top: union.y, k }, 1, true);
  cutPaperShape(ctx, canvas.width, canvas.height, union.width);
  return { canvas, aspect };
}

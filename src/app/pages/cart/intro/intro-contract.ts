// Shared types for the cart printer intro, so the scene, the timeline and the component
// can be built separately against one contract

// Animated values the GSAP timeline tweens; the scene's apply() maps them onto meshes
export interface IntroState {
  // Printer pop-in, 0 hidden .. 1 in place
  pop: number;
  // Paper fed out of the slot, 0 none .. 1 the whole ticket
  feed: number;
  // Body wobble from a feed jerk, -1 .. 1
  jitter: number;
  // Body squash from a feed jerk, 0 none .. 1 strongest
  squash: number;
  // Cut moment, 0 attached .. 1 torn off and lifted
  cut: number;
  // Landing, 0 at the printer .. 1 standing on the target rect (or past the camera without one)
  fly: number;
  // Printer leaving while the ticket lands, 0 in place .. 1 gone
  exit: number;
  // Paper curl, 0 flat .. 1 fully curled
  curl: number;
  // Status light, 0 off .. 1 on
  ledOn: number;
  // Status light colour, 0 printing (sun) .. 1 done (brand-leaf)
  ledDone: number;
}

// Colours read from the @theme tokens, as CSS colour strings
export interface IntroPalette {
  apron: string;
  amber: string;
  cream: string;
  leaf: string;
  duskCard: string;
  dayInk: string;
  wood: string;
  woodDark: string;
  sun: string;
  sunSet: string;
  skyDawn: string;
}

// Viewport-relative CSS pixel rectangle
export interface LandingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrinterIntroScene {
  readonly state: IntroState;
  // CSS pixel size of the canvas
  resize(width: number, height: number): void;
  // Where the ticket ends up (a screen rect in a viewport of the given size), or null to fly
  // past the camera instead; recomputed on resize
  setLanding(rect: LandingRect | null, viewport: { width: number; height: number }): void;
  // Mouse position, each axis -1 .. 1 (left/top negative) and already eased by the host. It sways
  // the camera and turns the printer, fading to nothing by the end of the landing
  setPointer(x: number, y: number): void;
  // Push the current state onto the meshes
  apply(): void;
  render(): void;
  // Release every geometry, material, texture and the renderer; safe to call twice
  dispose(): void;
}

export interface PrinterIntroSceneOptions {
  dpr: number;
  palette: IntroPalette;
  // Ticket artwork drawn from the card's layout by receipt-texture.ts
  receipt: HTMLCanvasElement;
  // Ticket height over width (default 2), matching the receipt canvas; run it through
  // ticketAspect so the host and the scene agree on the value
  paperAspect?: number;
}

// Ticket height over width when the card's own is unknown
const DEFAULT_TICKET_ASPECT = 2;
// Sanity range for the 3D ticket only; real cards sit well inside it, so the texture is never
// squeezed in practice and the landing, which is sized by width, stays exact
const MIN_TICKET_ASPECT = 0.25;
const MAX_TICKET_ASPECT = 8;

// The one place the ticket's proportions are decided: used by the host for the texture's aspect
// and by the scene for the plane, so both always agree
export function ticketAspect(requested?: number): number {
  if (requested === undefined || !(requested > 0)) return DEFAULT_TICKET_ASPECT;
  return Math.min(MAX_TICKET_ASPECT, Math.max(MIN_TICKET_ASPECT, requested));
}

// Moments in the timeline, in seconds
export interface IntroBeats {
  // Printer has popped in
  pop: number;
  // Feeding ends
  feed: number;
  // Paper is torn off
  cut: number;
  // Landing ends: the ticket stands on the target
  fly: number;
  // The real page starts fading in
  reveal: number;
  // The canvas starts fading out
  fadeStart: number;
  // The canvas is gone
  fadeEnd: number;
  // done fires
  total: number;
}

export interface IntroTimelineCallbacks {
  onFrame(): void;
  // The ticket is about to leave for its landing spot (the cue to measure the target)
  onLand?(): void;
  onReveal(): void;
  onDone(): void;
}

export function initialIntroState(): IntroState {
  return {
    pop: 0,
    feed: 0,
    jitter: 0,
    squash: 0,
    cut: 0,
    fly: 0,
    exit: 0,
    curl: 0.8,
    ledOn: 0,
    ledDone: 0,
  };
}

// Shared contract for the cart backdrop scenes (pure types, no Angular imports)

// CSS color strings read from the design tokens
export interface Palette {
  amber: string;
  apron: string;
  sun: string;
  sunSet: string;
  skyDawn: string;
}

// Per-frame inputs shared by every scene
export interface Frame {
  // Parallax target in -1..1, already eased
  px: number;
  py: number;
  // 0 is warm, 1 is cool
  mood: number;
  palette: Palette;
  // Elapsed time in seconds
  time: number;
}

// Rendering limits chosen once from the device
export interface Budget {
  // 0.4..1, multiplies particle counts
  scale: number;
  dpr: number;
  lowPower: boolean;
}

export interface BackdropScene {
  resize(width: number, height: number): void;
  step(dt: number, frame: Frame): void;
  draw(g: CanvasRenderingContext2D, frame: Frame): void;
  dispose(): void;
}

export type SceneFactory = (budget: Budget, rand: () => number) => BackdropScene;

export type BackdropMood = 'warm' | 'cool';

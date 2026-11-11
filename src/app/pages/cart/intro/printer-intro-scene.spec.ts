import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroPalette, ticketAspect } from './intro-contract';
import { cameraZ, createPrinterIntroScene, paperPose, readIntroPalette } from './printer-intro-scene';

type RoundedBoxClass = typeof import('three/addons/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;

const DEG = Math.PI / 180;

const palette: IntroPalette = {
  apron: '#c8312b',
  amber: '#f0a500',
  cream: '#f5e6c8',
  leaf: '#5b9a4b',
  duskCard: '#f6ede2',
  dayInk: '#1c2433',
  wood: '#b5763d',
  woodDark: '#7a4a22',
  sun: '#f4c26b',
  sunSet: '#e8865a',
  skyDawn: '#b8ccd5',
};

interface Disposable {
  dispose: ReturnType<typeof vi.fn>;
}

// Minimal stand-in for the parts of three that the scene touches. With `real`, the vectors,
// quaternions and the camera are three's own, so the landing maths can be checked numerically
function makeThree(real = false) {
  class Vec {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0,
    ) {}
    set = vi.fn((x: number, y: number, z: number) => {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    });
    setScalar = vi.fn((v: number) => {
      this.x = v;
      this.y = v;
      this.z = v;
      return this;
    });
    copy = vi.fn((o: Vec) => {
      this.x = o.x;
      this.y = o.y;
      this.z = o.z;
      return this;
    });
    lerpVectors = vi.fn(() => this);
    addScaledVector = vi.fn(() => this);
  }

  class Quat {
    identity = vi.fn(() => this);
    copy = vi.fn(() => this);
    slerpQuaternions = vi.fn(() => this);
    setFromAxisAngle = vi.fn(() => this);
    multiply = vi.fn(() => this);
  }

  const V = (real ? Vector3 : Vec) as unknown as typeof Vec;
  const Q = (real ? Quaternion : Quat) as unknown as typeof Quat;

  class Color {
    set = vi.fn(() => this);
    copy = vi.fn(() => this);
    lerp = vi.fn(() => this);
    multiplyScalar = vi.fn(() => this);
    constructor(readonly input?: unknown) {}
  }

  class Obj {
    position = new V();
    rotation = new V();
    scale = new V(1, 1, 1);
    quaternion = new Q();
    visible = true;
    frustumCulled = true;
    renderOrder = 0;
    add = vi.fn();
  }

  class Group extends Obj {
    constructor() {
      super();
      made.groups.push(this);
    }
  }

  class Mesh extends Obj {
    constructor(
      readonly geometry: unknown,
      readonly material: unknown,
    ) {
      super();
      made.meshes.push(this);
    }
  }

  class Light extends Obj {
    constructor(..._args: unknown[]) {
      super();
    }
  }

  class Geo {
    dispose = vi.fn();
    positions = { setXYZ: vi.fn(), needsUpdate: false };
    getAttribute = vi.fn(() => this.positions);
    constructor(..._args: unknown[]) {
      made.geometries.push(this);
    }
  }

  class Mat {
    color = new Color();
    dispose = vi.fn();
    constructor(params: object = {}) {
      Object.assign(this, params);
      // Real materials copy colours into their own instances; keep the mock's own
      this.color = new Color();
      made.materials.push(this);
    }
  }

  class ToonMat extends Mat {
    constructor(params: object = {}) {
      super(params);
      made.toon.push(this);
    }
  }

  class Texture {
    dispose = vi.fn();
    repeat = new Vec();
    offset = new Vec();
    colorSpace = '';
    anisotropy = 1;
    constructor(readonly image?: unknown) {
      made.textures.push(this);
    }
  }

  class Renderer {
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    outputColorSpace = '';
    constructor(readonly options: Record<string, unknown>) {
      made.renderers.push(this);
    }
  }

  class Camera extends Obj {
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
    getWorldDirection = vi.fn((v: Vec) => v);
    constructor(
      _fov: number,
      public aspect: number,
    ) {
      super();
      made.cameras.push(this);
    }
  }

  class RealCamera extends PerspectiveCamera {
    constructor(fov: number, aspect: number) {
      super(fov, aspect, 0.1, 60);
      made.cameras.push(this as never);
    }
  }

  class Scene {
    add = vi.fn();
    remove = vi.fn();
    attach = vi.fn();
    constructor() {
      made.scenes.push(this);
    }
  }

  const made = {
    groups: [] as Group[],
    meshes: [] as Mesh[],
    geometries: [] as Geo[],
    materials: [] as Mat[],
    toon: [] as ToonMat[],
    textures: [] as Texture[],
    renderers: [] as Renderer[],
    cameras: [] as Camera[],
    scenes: [] as Scene[],
  };

  const raw = {
    WebGLRenderer: Renderer,
    Scene,
    PerspectiveCamera: real ? RealCamera : Camera,
    Vector3: V,
    Quaternion: Q,
    Color,
    Group,
    Mesh,
    HemisphereLight: Light,
    DirectionalLight: Light,
    CylinderGeometry: class extends Geo {},
    BoxGeometry: class extends Geo {},
    SphereGeometry: class extends Geo {},
    CapsuleGeometry: class extends Geo {},
    PlaneGeometry: class extends Geo {},
    MeshToonMaterial: ToonMat,
    MeshBasicMaterial: class extends Mat {},
    DataTexture: Texture,
    CanvasTexture: Texture,
    RedFormat: 1028,
    NearestFilter: 1003,
    RepeatWrapping: 1000,
    SRGBColorSpace: 'srgb',
    FrontSide: 0,
    BackSide: 1,
  };

  const RoundedBox = class extends Geo {};

  return {
    three: raw as unknown as typeof import('three'),
    raw,
    made,
    RoundedBox: RoundedBox as unknown as RoundedBoxClass,
  };
}

// Fake 2D context so the shadow texture draws without a canvas package
function stubCanvas(): void {
  const ctx = {
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    fillStyle: '',
    globalCompositeOperation: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
}

function make(dpr = 2, real = false, paperAspect?: number) {
  const mocks = makeThree(real);
  const canvas = document.createElement('canvas');
  const receipt = document.createElement('canvas');
  const scene = createPrinterIntroScene(mocks.three, mocks.RoundedBox, canvas, {
    dpr,
    palette,
    receipt,
    paperAspect,
  });
  return { scene, ...mocks };
}

describe('cameraZ', () => {
  // Landscape and square keep the base distance
  it('stays at 7.5 on landscape', () => {
    expect(cameraZ(16 / 9)).toBe(7.5);
    expect(cameraZ(1)).toBe(7.5);
  });

  // Portrait pulls back in proportion, then stops at the cap
  it('pulls back on portrait and caps at 12', () => {
    expect(cameraZ(0.8)).toBeCloseTo(9.375);
    expect(cameraZ(0.5)).toBe(12);
    expect(cameraZ(0.2)).toBe(12);
  });
});

describe('paperPose', () => {
  // With nothing fed every row stays folded at the slot
  it('keeps all rows at the slot when nothing is fed', () => {
    for (const s of [0, 0.4, 1.3, 2.6]) {
      const pose = paperPose(s, 0, 0.8, 1.7);
      expect(pose.y).toBeCloseTo(0);
      expect(pose.z).toBeCloseTo(0);
    }
  });

  // The angle starts at 70 degrees and falls along the paper when it curls
  it('decreases the angle monotonically along s when curled', () => {
    let prev = paperPose(0, 2.6, 0.8, 0).angle;
    expect(prev).toBeCloseTo(70 * DEG);
    for (let s = 0.1; s <= 2.6001; s += 0.1) {
      const angle = paperPose(s, 2.6, 0.8, 0).angle;
      expect(angle).toBeLessThan(prev);
      prev = angle;
    }
    expect(prev).toBeCloseTo(70 * DEG - 0.8 * 2.6 * 55 * DEG);
  });

  // No curl means a straight ramp at the rise angle
  it('stays straight at zero curl', () => {
    const pose = paperPose(2, 2.6, 0, 0);
    expect(pose.angle).toBeCloseTo(70 * DEG);
    expect(pose.y).toBeCloseTo(2 * Math.sin(70 * DEG), 1);
    expect(pose.z).toBeCloseTo(2 * Math.cos(70 * DEG), 1);
  });

  // The paper leaves the slot upward before it bends forward
  it('rises above the slot and moves forward', () => {
    const pose = paperPose(1, 2.6, 0.8, 0);
    expect(pose.y).toBeGreaterThan(0.5);
    expect(pose.z).toBeGreaterThan(0);
  });
});

describe('readIntroPalette', () => {
  // Without the stylesheet loaded every token falls back to its styles.css value
  it('falls back to the theme hex values', () => {
    const read = readIntroPalette();
    expect(read.apron).toBe('#c8312b');
    expect(read.skyDawn).toBe('#b8ccd5');
    expect(read.woodDark).toBe('#7a4a22');
    expect(Object.values(read).every((v) => v.length > 0)).toBe(true);
  });
});

describe('createPrinterIntroScene', () => {
  beforeEach(() => stubCanvas());
  afterEach(() => vi.restoreAllMocks());

  // The first render needs no apply() call from the host
  it('creates a transparent renderer and renders once', () => {
    const { scene, made } = make();
    const [renderer] = made.renderers;
    expect(renderer.options['alpha']).toBe(true);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);

    // Creation already applied the state to the printer group
    expect(made.groups[0].scale.setScalar).toHaveBeenCalled();
    scene.render();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  // Exact cream: sRGB output, and unlit paper that tone mapping cannot shift
  it('outputs sRGB and draws the paper unlit, untoned and alpha-tested', () => {
    const { made } = make();
    expect(made.renderers[0].outputColorSpace).toBe('srgb');
    const faces = made.materials.filter((m) => 'map' in m && 'side' in m) as unknown as Record<
      string,
      unknown
    >[];
    // Front and back of the paper only: the texture already matches the card
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face['toneMapped']).toBe(false);
      expect(face['alphaTest']).toBe(0.5);
    }
    // Every ticket texture is tagged sRGB so it is decoded before output
    const tagged = made.textures.filter((t) => t.colorSpace === 'srgb');
    expect(tagged.length).toBeGreaterThanOrEqual(2);
  });

  // No extra sheet is laid over the printed face
  it('adds no layer over the ticket', () => {
    const { made } = make();
    expect(made.meshes.some((m) => m.renderOrder === 1)).toBe(false);
  });

  // Every toon surface shares one nearest-filtered ramp
  it('shares one gradient map across toon materials', () => {
    const { made } = make();
    const maps = new Set(
      made.toon.map((m) => (m as unknown as { gradientMap: unknown }).gradientMap),
    );
    expect(made.toon.length).toBeGreaterThan(1);
    expect(maps.size).toBe(1);
  });

  // pop = 0 hides the printer, pop = 1 shows it at full size
  it('maps pop onto visibility and scale', () => {
    const { scene, made } = make();
    const printer = made.groups[0];
    expect(printer.visible).toBe(false);
    scene.state.pop = 1;
    scene.apply();
    expect(printer.visible).toBe(true);
    expect(printer.scale.x).toBeCloseTo(1);
    expect(printer.position.y).toBeGreaterThan(0);
  });

  // Squash flattens the body group and widens it a little
  it('squashes the body group', () => {
    const { scene, made } = make();
    const body = made.groups[1];
    scene.state.squash = 1;
    scene.apply();
    expect(body.scale.y).toBeCloseTo(0.97);
    expect(body.scale.x).toBeGreaterThan(1);
  });

  // Feeding writes every ticket row into the position attribute
  it('deforms the ticket rows on apply', () => {
    const { scene, made } = make();
    const geometry = made.geometries.find((g) => g.getAttribute.mock.calls.length > 0);
    expect(geometry).toBeDefined();
    const setXYZ = geometry?.positions.setXYZ;
    setXYZ?.mockClear();
    scene.state.feed = 1;
    scene.apply();
    // 49 rows, two vertices each
    expect(setXYZ).toHaveBeenCalledTimes(98);
    expect(geometry?.positions.needsUpdate).toBe(true);
  });

  // The ticket detaches from the printer on the first cut frame only
  it('attaches the paper to the scene once when cut starts', () => {
    const { scene, made } = make();
    scene.state.pop = 1;
    scene.state.feed = 1;
    scene.state.cut = 0.3;
    scene.apply();
    scene.state.cut = 0.8;
    scene.apply();
    expect(made.scenes[0].attach).toHaveBeenCalledTimes(1);
  });

  // A rewound timeline gives the ticket back to the printer
  it('returns the paper to the printer when cut goes back to zero', () => {
    const { scene, made } = make();
    scene.state.cut = 0.5;
    scene.apply();
    const paper = made.scenes[0].attach.mock.calls[0][0];
    scene.state.cut = 0;
    scene.apply();
    expect(made.groups[0].add).toHaveBeenCalledWith(paper);
  });

  // Flying scales the ticket up and steers it toward the camera
  it('flies the paper toward the camera', () => {
    const { scene, made } = make();
    scene.state.cut = 1;
    scene.state.fly = 1;
    scene.apply();
    const paper = made.scenes[0].attach.mock.calls[0][0];
    expect(paper.scale.x).toBeCloseTo(1.6);
    expect(paper.position.lerpVectors).toHaveBeenCalled();
    expect(paper.quaternion.slerpQuaternions).toHaveBeenCalled();
  });

  // The light colour and brightness follow the LED state without new colours
  it('drives the LED colour from the state', () => {
    const { scene, made } = make();
    const led = made.materials.find((m) => m.color.multiplyScalar.mock.calls.length > 0);
    expect(led).toBeDefined();
    const before = led?.color.multiplyScalar.mock.calls.length ?? 0;
    scene.state.ledOn = 1;
    scene.state.ledDone = 1;
    scene.apply();
    expect(led?.color.multiplyScalar.mock.calls.length).toBe(before + 1);
    expect(led?.color.multiplyScalar.mock.lastCall?.[0]).toBeCloseTo(1);
  });

  // Resize sets the buffer, the pixel ratio and a portrait camera distance
  it('resizes the renderer and pulls the camera back on portrait', () => {
    const { scene, made } = make(1.5);
    scene.resize(300, 1000);
    const [renderer] = made.renderers;
    expect(renderer.setSize).toHaveBeenCalledWith(300, 1000, false);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    expect(made.cameras[0].aspect).toBeCloseTo(0.3);
    expect(made.cameras[0].position.set).toHaveBeenLastCalledWith(0, 1.5, 12);
  });

  // Mouse right moves the camera left and mouse down moves it up, around the same look-at point
  it('offsets the camera by the pointer and keeps looking at the same point', () => {
    const { scene, made } = make();
    const camera = made.cameras[0];
    scene.setPointer(1, 1);
    scene.apply();
    expect(camera.position.x).toBeCloseTo(-0.7);
    expect(camera.position.y).toBeCloseTo(1.5 + 0.45);
    expect(camera.position.z).toBeCloseTo(7.5);

    // The opposite corner swings the other way
    scene.setPointer(-1, -1);
    scene.apply();
    expect(camera.position.x).toBeCloseTo(0.7);
    expect(camera.position.y).toBeCloseTo(1.5 - 0.45);

    // Every placement aims at one shared target, a little above the floor
    const targets = camera.lookAt.mock.calls.map((c) => c[0]);
    expect(targets.every((t) => t === targets[0])).toBe(true);
    expect(targets[0].y).toBeCloseTo(0.55);
    expect(targets[0].x).toBe(0);
  });

  // The host eases and bounds its values, but the scene stays safe on its own
  it('clamps the pointer to -1 .. 1 and treats a non-finite value as centred', () => {
    const { scene, made } = make();
    const camera = made.cameras[0];
    scene.setPointer(9, -9);
    scene.apply();
    expect(camera.position.x).toBeCloseTo(-0.7);
    expect(camera.position.y).toBeCloseTo(1.5 - 0.45);

    scene.setPointer(Number.NaN, Number.POSITIVE_INFINITY);
    scene.apply();
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.y).toBeCloseTo(1.5);
  });

  // The offset is gone when the landing completes, and half-way through it is half as large
  it('fades the camera offset to exactly zero as fly reaches 1', () => {
    const { scene, made } = make();
    const camera = made.cameras[0];
    scene.setPointer(1, -1);

    scene.state.fly = 0.5;
    scene.apply();
    expect(camera.position.x).toBeCloseTo(-0.35);
    expect(camera.position.y).toBeCloseTo(1.5 - 0.225);

    scene.state.fly = 1;
    scene.apply();
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(1.5);
    expect(camera.position.z).toBe(7.5);
  });

  // A resize keeps the sway on top of the new base distance
  it('keeps the pointer offset when the canvas is resized', () => {
    const { scene, made } = make();
    scene.setPointer(1, 0);
    scene.resize(300, 1000);
    expect(made.cameras[0].position.x).toBeCloseTo(-0.7);
    expect(made.cameras[0].position.z).toBe(12);
  });

  // The printer turns toward the pointer on top of its base pose, and back at fly = 1
  it('yaws and pitches the printer with the pointer', () => {
    const { scene, made } = make();
    const printer = made.groups[0];
    scene.apply();
    const baseYaw = printer.rotation.y;
    expect(printer.rotation.x).toBe(0);

    scene.setPointer(1, 1);
    scene.apply();
    expect(printer.rotation.y).toBeCloseTo(baseYaw + 0.12);
    expect(printer.rotation.x).toBeCloseTo(0.06);

    scene.setPointer(-1, -1);
    scene.apply();
    expect(printer.rotation.y).toBeCloseTo(baseYaw - 0.12);
    expect(printer.rotation.x).toBeCloseTo(-0.06);

    // Landed: back on the base pose
    scene.state.fly = 1;
    scene.apply();
    expect(printer.rotation.y).toBeCloseTo(baseYaw);
    expect(printer.rotation.x).toBeCloseTo(0);
  });

  // Zero sizes are ignored
  it('ignores an empty size', () => {
    const { scene, made } = make();
    scene.resize(0, 0);
    expect(made.renderers[0].setSize).not.toHaveBeenCalled();
  });

  // Dispose frees every created resource once, and later calls do nothing
  it('disposes every geometry, material and texture and is idempotent', () => {
    const { scene, made } = make();
    scene.dispose();
    const all: Disposable[] = [...made.geometries, ...made.materials, ...made.textures];
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) expect(item.dispose).toHaveBeenCalledTimes(1);
    expect(made.renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(made.renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
    expect(made.scenes[0].remove).toHaveBeenCalled();

    // A second dispose, apply or render does nothing
    scene.dispose();
    scene.apply();
    scene.render();
    for (const item of all) expect(item.dispose).toHaveBeenCalledTimes(1);
    expect(made.renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(made.renderers[0].render).not.toHaveBeenCalled();
  });

  // A failure part-way through building frees the GL context before rethrowing
  it('releases the renderer and rethrows when building fails', () => {
    const { three, raw, made, RoundedBox } = makeThree();
    raw.CapsuleGeometry = class {
      constructor() {
        throw new Error('boom');
      }
    } as never;
    const canvas = document.createElement('canvas');
    const receipt = document.createElement('canvas');
    expect(() =>
      createPrinterIntroScene(three, RoundedBox, canvas, { dpr: 1, palette, receipt }),
    ).toThrow('boom');
    expect(made.renderers[0].dispose).toHaveBeenCalled();
    expect(made.renderers[0].forceContextLoss).toHaveBeenCalled();
    // Whatever was built before the failure is freed too
    for (const item of [...made.geometries, ...made.materials, ...made.textures]) {
      expect(item.dispose).toHaveBeenCalledTimes(1);
    }
  });
});

describe('printer exit', () => {
  beforeEach(() => stubCanvas());
  afterEach(() => vi.restoreAllMocks());

  // The printer sinks and shrinks as exit grows, then disappears with its shadow
  it('sinks, shrinks and hides the printer and its shadow', () => {
    const { scene, made } = make();
    const printer = made.groups[0];
    const shadow = made.meshes.find((m) => m.rotation.x === -Math.PI / 2);
    scene.state.pop = 1;
    scene.apply();
    const restY = printer.position.y;

    // Halfway: 15 percent smaller and lower (the float bob moves y a little, hence the margin)
    scene.state.exit = 0.5;
    scene.apply();
    expect(printer.scale.x).toBeCloseTo(0.85);
    expect(printer.position.y).toBeLessThan(restY - 0.2);
    expect(printer.visible).toBe(true);

    // Gone: hidden, and the shadow went below the floor
    scene.state.exit = 1;
    scene.apply();
    expect(printer.visible).toBe(false);
    expect(shadow?.visible).toBe(false);
    expect(shadow?.position.y).toBeCloseTo(-0.59);

    // Rewinding brings it back
    scene.state.exit = 0;
    scene.apply();
    expect(printer.visible).toBe(true);
  });
});

describe('ticket proportions', () => {
  beforeEach(() => stubCanvas());
  afterEach(() => vi.restoreAllMocks());

  // Rows written for a fully fed, fully landed ticket, right-hand vertices only
  function landedRows(paperAspect?: number) {
    const { scene, made } = make(2, false, paperAspect);
    const geometry = made.geometries.find((g) => g.getAttribute.mock.calls.length > 0);
    geometry?.positions.setXYZ.mockClear();
    scene.state.feed = 1;
    scene.state.curl = 0.8;
    scene.state.fly = 1;
    scene.apply();
    return (geometry?.positions.setXYZ.mock.calls ?? []).filter((c) => c[0] % 2 === 1);
  }

  // Length of the flattened ticket, read from its first and last row
  const span = (rows: number[][]) =>
    (rows[0][2] - rows[rows.length - 1][2]) / Math.sin(70 * DEG);

  // Width stays 1.3, so a ticket is 1.3 times its aspect long, and 2.6 by default
  it('is 1.3 times the aspect long, 2.6 by default', () => {
    expect(span(landedRows())).toBeCloseTo(2.6);
    expect(span(landedRows(1.25))).toBeCloseTo(1.625);
  });

  // Real card aspects pass through; only absurd ones are capped, to 0.25 .. 8
  it('keeps tall and wide aspects and caps absurd ones', () => {
    expect(span(landedRows(4))).toBeCloseTo(5.2);
    expect(span(landedRows(6))).toBeCloseTo(7.8);
    expect(span(landedRows(20))).toBeCloseTo(10.4);
    expect(span(landedRows(0.1))).toBeCloseTo(0.325);
  });

  // One helper decides the proportions for both the host and the scene
  it('ticketAspect defaults a missing or invalid aspect to 2 and caps the rest', () => {
    expect(ticketAspect()).toBe(2);
    expect(ticketAspect(0)).toBe(2);
    expect(ticketAspect(Number.NaN)).toBe(2);
    expect(ticketAspect(1.25)).toBe(1.25);
    expect(ticketAspect(6)).toBe(6);
    expect(ticketAspect(20)).toBe(8);
    expect(ticketAspect(0.1)).toBe(0.25);
  });

  // A landed ticket has no curl and no flutter left, and sits centred on its own origin
  it('lands perfectly flat and centred', () => {
    const rows = landedRows();
    // Every row lies on one straight line through the origin
    for (const call of rows) {
      expect(call[2] * Math.cos(70 * DEG) - call[3] * Math.sin(70 * DEG)).toBeCloseTo(0, 6);
    }
    const meanY = rows.reduce((sum, c) => sum + c[2], 0) / rows.length;
    expect(meanY).toBeCloseTo(0, 6);
  });
});

describe('setLanding', () => {
  beforeEach(() => stubCanvas());
  afterEach(() => vi.restoreAllMocks());

  const rect = { x: 300, y: 100, width: 400, height: 500 };
  const viewport = { width: 1000, height: 600 };
  // Rect centre in normalised device coordinates
  const targetNdc = { x: 0, y: 1 - (350 / 600) * 2 };

  interface Placed {
    position: Vector3;
    quaternion: Quaternion;
    scale: Vector3;
  }

  // A scene on three's own maths, resized to the viewport and aimed at the rect; the ticket has
  // the rect's own aspect, as the host gives it
  function aimed() {
    const h = make(2, true, rect.height / rect.width);
    h.scene.resize(viewport.width, viewport.height);
    h.scene.setLanding(rect, viewport);
    return h;
  }

  // Runs the ticket to the end of its flight and hands back what the scene did to it
  function land(h: ReturnType<typeof make>) {
    h.scene.state.feed = 1;
    h.scene.state.cut = 1;
    h.scene.state.fly = 1;
    h.scene.apply();
    const paper = h.made.scenes[0].attach.mock.calls[0][0] as Placed;
    const camera = h.made.cameras[0] as unknown as PerspectiveCamera;
    camera.updateMatrixWorld();
    return { paper, camera, forward: camera.getWorldDirection(new Vector3()) };
  }

  // World height of the view 3 units out
  const viewHeight = 2 * 3 * Math.tan(17.5 * DEG);

  // Ticket scale that makes a rect of this width fill the same share of the screen at 3 units
  const scaleFor = (width: number) => ((width / viewport.height) * viewHeight) / 1.3;

  // Screen pixels covered by a length in world units at 3 units out
  const pixels = (world: number) => (world / viewHeight) * viewport.height;

  // The centre sits on the plane 3 units out, on the ray through the rect centre
  it('puts the ticket 3 units out, centred on the rect', () => {
    const { paper, camera, forward } = land(aimed());
    expect(paper.position.clone().sub(camera.position).dot(forward)).toBeCloseTo(3, 5);
    const ndc = paper.position.clone().project(camera);
    expect(ndc.x).toBeCloseTo(targetNdc.x, 5);
    expect(ndc.y).toBeCloseTo(targetNdc.y, 5);
  });

  // The scale follows the rect width, so a rect half as wide gives a ticket half the size
  it('scales the ticket in proportion to the rect width', () => {
    const h = aimed();
    const { paper } = land(h);
    expect(paper.scale.x).toBeCloseTo(scaleFor(400), 6);

    h.scene.setLanding({ ...rect, width: 200 }, viewport);
    h.scene.apply();
    expect(paper.scale.x).toBeCloseTo(scaleFor(200), 6);
    expect(paper.scale.x).toBeCloseTo(scaleFor(400) / 2, 6);
  });

  // The landed plane covers the rect exactly, width and height, with its top on the rect's top
  it.each([1.25, 4, 6])('covers a card of aspect %d exactly, top edge on the card top', (aspect) => {
    const card = { x: 300, y: 50, width: 100, height: 100 * aspect };
    const h = make(2, true, aspect);
    h.scene.resize(viewport.width, viewport.height);
    h.scene.setLanding(card, viewport);
    const { paper, camera } = land(h);

    const width = pixels(paper.scale.x * 1.3);
    const height = pixels(paper.scale.x * 1.3 * aspect);
    expect(width).toBeCloseTo(card.width, 4);
    expect(height).toBeCloseTo(card.height, 4);
    const ndc = paper.position.clone().project(camera);
    const centreX = ((ndc.x + 1) / 2) * viewport.width;
    const centreY = ((1 - ndc.y) / 2) * viewport.height;
    expect(centreX - width / 2).toBeCloseTo(card.x, 3);
    expect(centreY - height / 2).toBeCloseTo(card.y, 3);
  });

  // Past the sanity cap the plane is capped, but the width and the top edge still match the card
  it('keeps the card width and top edge for an aspect beyond the cap', () => {
    const card = { x: 300, y: 40, width: 50, height: 600 };
    const h = make(2, true, card.height / card.width);
    h.scene.resize(viewport.width, viewport.height);
    h.scene.setLanding(card, viewport);
    const { paper, camera } = land(h);

    // 12 is capped to 8, so the plane is 8 times as tall as wide
    const width = pixels(paper.scale.x * 1.3);
    const height = pixels(paper.scale.x * 1.3 * 8);
    expect(width).toBeCloseTo(card.width, 4);
    const ndc = paper.position.clone().project(camera);
    const centreY = ((1 - ndc.y) / 2) * viewport.height;
    expect(centreY - height / 2).toBeCloseTo(card.y, 3);
  });

  // Flat paper parallel to the screen: its up is the camera's up and its front faces the viewer
  it('ends parallel to the image plane, upright and facing the camera', () => {
    const { paper, camera, forward } = land(aimed());
    // In its own frame the flattened ticket rises at 70 degrees, its front leaning the other way
    const up = new Vector3(0, Math.sin(70 * DEG), Math.cos(70 * DEG)).applyQuaternion(
      paper.quaternion,
    );
    const front = new Vector3(0, -Math.cos(70 * DEG), Math.sin(70 * DEG)).applyQuaternion(
      paper.quaternion,
    );
    const cameraUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    expect(up.distanceTo(cameraUp)).toBeCloseTo(0, 5);
    expect(front.dot(forward)).toBeCloseTo(-1, 5);
  });

  // A resize moves the camera, so the stored rect is projected again from the new view
  it('recomputes the landing on resize', () => {
    const h = aimed();
    const { paper, camera, forward } = land(h);
    const before = paper.position.clone();

    h.scene.resize(500, 900);
    const after = paper.position.clone();
    expect(after.distanceTo(before)).toBeGreaterThan(0.1);
    camera.getWorldDirection(forward);
    camera.updateMatrixWorld();
    expect(after.clone().sub(camera.position).dot(forward)).toBeCloseTo(3, 5);
    const ndc = after.clone().project(camera);
    expect(ndc.x).toBeCloseTo(targetNdc.x, 5);
    expect(ndc.y).toBeCloseTo(targetNdc.y, 5);
  });

  // The landing is worked out for the base camera, so the pointer must not move where it lands
  it('lands in the same place whatever the pointer does, on the base camera', () => {
    const plain = aimed();
    const base = (plain.made.cameras[0] as unknown as PerspectiveCamera).position.clone();
    const reference = land(plain).paper;

    const swayed = aimed();
    // The card is measured and the view resized while the pointer is off-centre
    swayed.scene.setPointer(1, -1);
    swayed.scene.setLanding(rect, viewport);
    swayed.scene.setPointer(-0.5, 0.8);
    swayed.scene.resize(viewport.width, viewport.height);
    const { paper, camera } = land(swayed);

    expect(paper.position.distanceTo(reference.position)).toBeCloseTo(0, 6);
    expect(paper.quaternion.angleTo(reference.quaternion)).toBeCloseTo(0, 6);
    expect(paper.scale.x).toBeCloseTo(reference.scale.x, 8);
    // At fly = 1 the camera is exactly the base camera
    expect(camera.position.distanceTo(base)).toBeCloseTo(0, 8);
    const ndc = paper.position.clone().project(camera);
    expect(ndc.x).toBeCloseTo(targetNdc.x, 5);
    expect(ndc.y).toBeCloseTo(targetNdc.y, 5);
  });

  // Without a target the ticket still flies out past the camera, as before
  it('falls back to the fly-out when the landing is null', () => {
    const h = aimed();
    h.scene.setLanding(null, viewport);
    const { paper, camera, forward } = land(h);
    expect(paper.scale.x).toBeCloseTo(1.6);
    expect(paper.position.clone().sub(camera.position).dot(forward)).toBeCloseTo(-0.5, 5);
  });

  // A rect without area cannot be landed on either
  it('falls back to the fly-out for an empty rect', () => {
    const h = aimed();
    h.scene.setLanding({ ...rect, height: 0 }, viewport);
    const { paper } = land(h);
    expect(paper.scale.x).toBeCloseTo(1.6);
  });
});

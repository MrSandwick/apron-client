import type {
  BufferAttribute,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  Side,
  Texture,
} from 'three';
import {
  IntroPalette,
  PrinterIntroScene,
  PrinterIntroSceneOptions,
  initialIntroState,
  ticketAspect,
} from './intro-contract';

// Three.js toon-shaded receipt printer for the cart intro (plain TypeScript, no Angular). three and
// RoundedBoxGeometry are passed in so the host can lazy-load them and tests can hand in mocks

type Three = typeof import('three');
type RoundedBox = typeof import('three/addons/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;

const DEG = Math.PI / 180;

const FOV = 35;
const CAMERA_X = 0;
const CAMERA_Y = 1.5;
const LOOK_Y = 0.55;
const DEFAULT_ASPECT = 16 / 9;
const LANDSCAPE_Z = 7.5;
const MAX_Z = 12;

// Mouse response at full pointer travel. The camera moves opposite on x and with the pointer on y
// while it keeps looking at the same point, so near things shift toward the pointer like the 2D
// backdrop does; the printer turns the same way, which adds to that instead of cancelling it
const SWAY_X = -0.7;
const SWAY_Y = 0.45;
const PRINTER_YAW = 0.12;
const PRINTER_PITCH = 0.06;

// Printer layout, in world units. The printer group's origin sits on the floor; the body group's
// origin is the underside of the body, so a squash keeps the base planted
const BODY_BASE = 0.12;
const SLOT_TOP = 1.36;
const SLOT_Z = 0.62;
const VIEW_TURN = -0.35;
const FLOAT_BASE = 0.06;
const FLOAT_AMP = 0.05;
const JITTER_MAX = 1.5 * DEG;

// Ticket geometry: width, and the row segments along the length
const PAPER_W = 1.3;
const PAPER_ROWS = 48;
// Pixels less opaque than this are cut away, which gives the corners and the tear a clean edge
const PAPER_ALPHA_TEST = 0.5;

// Paper path: rises at RISE out of the slot and bends by BEND per unit length at full curl
const RISE = 70 * DEG;
const BEND = 55 * DEG;
const FLUTTER = 0.03;

const CUT_LIFT = 0.15;
const FLY_SCALE = 0.6;
// How far behind the camera the ticket ends up when there is nowhere to land
const FLY_PAST = 0.5;

// Landing: the ticket stands this far in front of the camera, parallel to the image plane
const LAND_DISTANCE = 3;
// Printer sink and shrink while it leaves
const EXIT_SINK = 0.6;
const EXIT_SHRINK = 0.3;

const OUTLINE = 1.035;
const OUTLINE_SMALL = 1.06;

interface Disposable {
  dispose(): void;
}

// Hex fallbacks copied from the @theme block in styles.css, for SSR and tests
const TOKENS: Record<keyof IntroPalette, readonly [string, string]> = {
  apron: ['--color-brand-apron', '#c8312b'],
  amber: ['--color-brand-amber', '#f0a500'],
  cream: ['--color-brand-cream', '#f5e6c8'],
  leaf: ['--color-brand-leaf', '#5b9a4b'],
  duskCard: ['--color-dusk-card', '#f6ede2'],
  dayInk: ['--color-day-ink', '#1c2433'],
  wood: ['--color-kitchen-wood', '#b5763d'],
  woodDark: ['--color-kitchen-wood-dark', '#7a4a22'],
  sun: ['--color-sun', '#f4c26b'],
  sunSet: ['--color-sun-set', '#e8865a'],
  skyDawn: ['--color-sky-dawn', '#b8ccd5'],
};

// Reads the theme colours from the document, falling back to the stylesheet's own values
export function readIntroPalette(): IntroPalette {
  const style = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  const out = {} as IntroPalette;
  for (const key of Object.keys(TOKENS) as (keyof IntroPalette)[]) {
    const [token, fallback] = TOKENS[key];
    out[key] = style?.getPropertyValue(token).trim() || fallback;
  }
  return out;
}

// Camera distance: fixed on landscape, pulled back on portrait so the printer keeps its width
export function cameraZ(aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return LANDSCAPE_Z;
  return Math.min(MAX_Z, LANDSCAPE_Z / aspect);
}

interface Pose {
  y: number;
  z: number;
  angle: number;
}

// Writes into `out` so the per-frame deformation allocates nothing; flutterGain 0 keeps the paper still
function writePose(
  s: number,
  fed: number,
  curl: number,
  time: number,
  out: Pose,
  flutterGain = 1,
): void {
  // Rows past the fed length have not left the slot yet
  const open = s > fed ? 0 : Math.max(0, s);
  const k = curl * BEND;
  const angle = RISE - k * open;
  let y: number;
  let z: number;
  if (Math.abs(k) < 1e-5) {
    y = open * Math.sin(RISE);
    z = open * Math.cos(RISE);
  } else {
    // Closed form of the integral of the tangent (cos angle forward, sin angle up)
    y = (Math.cos(angle) - Math.cos(RISE)) / k;
    z = (Math.sin(RISE) - Math.sin(angle)) / k;
  }
  // Flutter pushes along the paper's normal and fades in over the first unit so the root stays put
  const flutter = flutterGain * FLUTTER * Math.sin(8 * open - 12 * time) * Math.min(open, 1);
  out.y = y + flutter * Math.cos(angle);
  out.z = z - flutter * Math.sin(angle);
  out.angle = angle;
}

// Position of the paper at arc length s from the slot, with `fed` the length already out
export function paperPose(
  s: number,
  fed: number,
  curl: number,
  flutterTime: number,
): { y: number; z: number; angle: number } {
  const out: Pose = { y: 0, z: 0, angle: RISE };
  writePose(s, fed, curl, flutterTime, out);
  return out;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// Everything build() hands back for the per-frame code
interface Parts {
  printer: Group;
  body: Group;
  paper: Mesh;
  paperGeometry: BufferGeometry;
  shadow: Mesh;
  ledMaterial: MeshBasicMaterial;
}

export function createPrinterIntroScene(
  three: Three,
  RoundedBoxGeometry: RoundedBox,
  canvas: HTMLCanvasElement,
  options: PrinterIntroSceneOptions,
): PrinterIntroScene {
  const { palette } = options;
  const state = initialIntroState();

  // The ticket is 1.3 wide whatever its length, so it fits the 1.5 slot; its height follows the
  // card's real aspect, the same value the texture was drawn at
  const paperAspect = ticketAspect(options.paperAspect);
  const paperH = PAPER_W * paperAspect;

  // Everything created below is tracked here so dispose() can release it
  const geometries: Disposable[] = [];
  const materials: Disposable[] = [];
  const textures: Disposable[] = [];
  // Objects added to the scene, removed again on dispose
  const roots: Object3D[] = [];

  const renderer = new three.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(options.dpr);
  // Explicit, so textures tagged sRGB come out as the same colours they were drawn with
  renderer.outputColorSpace = three.SRGBColorSpace;

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(FOV, DEFAULT_ASPECT, 0.1, 60);
  const lookTarget = new three.Vector3(0, LOOK_Y, 0);

  // Base camera distance (changes with the aspect) and the eased mouse position
  let baseZ = cameraZ(DEFAULT_ASPECT);
  let pointerX = 0;
  let pointerY = 0;

  // Puts the camera on its base pose plus the mouse sway scaled by `weight` (0 is the base camera),
  // always looking at the same point
  function placeCamera(weight: number): void {
    camera.position.set(
      CAMERA_X + pointerX * SWAY_X * weight,
      CAMERA_Y + pointerY * SWAY_Y * weight,
      baseZ,
    );
    camera.lookAt(lookTarget);
  }
  placeCamera(0);

  let disposed = false;

  function release(): void {
    if (disposed) return;
    disposed = true;
    for (const root of roots) scene.remove(root);
    roots.length = 0;
    for (const item of [...geometries, ...materials, ...textures]) item.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const track = <T extends Disposable>(list: Disposable[], item: T): T => {
    list.push(item);
    return item;
  };

  // Soft elliptical blob in dayInk at 25 percent, drawn as ink masked by a radial alpha falloff
  function shadowTexture() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    // A missing or throwing 2D context leaves a blank texture, which is an acceptable fallback
    try {
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = palette.dayInk;
        g.fillRect(0, 0, size, size);
        const r = size / 2;
        const fade = g.createRadialGradient(r, r, 0, r, r, r);
        fade.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        fade.addColorStop(0.55, 'rgba(255, 255, 255, 0.16)');
        fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = fade;
        g.fillRect(0, 0, size, size);
      }
    } catch {
      // Blank texture
    }
    const texture = new three.CanvasTexture(c);
    texture.colorSpace = three.SRGBColorSpace;
    return texture;
  }

  function build(): Parts {
    // One shared 3-step ramp gives every toon surface the same flat cel look
    const gradient = track(
      textures,
      new three.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, three.RedFormat),
    );
    gradient.minFilter = three.NearestFilter;
    gradient.magFilter = three.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.unpackAlignment = 1;
    gradient.needsUpdate = true;

    // Toon materials are shared per colour
    const toonCache = new Map<string, MeshToonMaterial>();
    const toon = (color: string): MeshToonMaterial => {
      let material = toonCache.get(color);
      if (!material) {
        material = track(
          materials,
          new three.MeshToonMaterial({ color: new three.Color(color), gradientMap: gradient }),
        );
        toonCache.set(color, material);
      }
      return material;
    };

    // One ink material for every outline hull
    const outlineMaterial = track(
      materials,
      new three.MeshBasicMaterial({ color: new three.Color(palette.dayInk), side: three.BackSide }),
    );

    // Solid mesh plus an inverted hull that reuses its geometry
    const solid = (
      parent: Object3D,
      geometry: BufferGeometry,
      material: Material,
      hullScale = OUTLINE,
    ): Mesh => {
      const mesh = new three.Mesh(geometry, material);
      const hull = new three.Mesh(geometry, outlineMaterial);
      hull.scale.setScalar(hullScale);
      mesh.add(hull);
      parent.add(mesh);
      return mesh;
    };

    const bodyGeometry = track(geometries, new RoundedBoxGeometry(2.2, 1.3, 1.7, 4, 0.28));
    const lidGeometry = track(geometries, new RoundedBoxGeometry(2.0, 0.25, 1.2, 4, 0.1));
    const rollGeometry = track(geometries, new three.CylinderGeometry(0.38, 0.38, 1.7, 24));
    const capGeometry = track(geometries, new three.CylinderGeometry(0.42, 0.42, 0.08, 24));
    const slotGeometry = track(geometries, new three.BoxGeometry(1.5, 0.08, 0.14));
    const ledGeometry = track(geometries, new three.SphereGeometry(0.07, 16, 12));
    const buttonGeometry = track(geometries, new three.CapsuleGeometry(0.07, 0.16, 4, 10));
    const badgeGeometry = track(geometries, new three.CylinderGeometry(0.22, 0.22, 0.06, 24));
    const footGeometry = track(geometries, new three.SphereGeometry(0.16, 14, 10));

    const printer = new three.Group();
    printer.rotation.y = VIEW_TURN;
    const body = new three.Group();
    body.position.y = BODY_BASE;
    printer.add(body);

    // Body, lid and the paper roll half-sunk at the back of the lid
    solid(body, bodyGeometry, toon(palette.apron)).position.set(0, 0.65, 0);
    solid(body, lidGeometry, toon(palette.duskCard)).position.set(0, 1.395, -0.2);
    const roll = solid(body, rollGeometry, toon(palette.cream));
    roll.position.set(0, 1.52, -0.5);
    roll.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const cap = solid(body, capGeometry, toon(palette.wood), OUTLINE_SMALL);
      cap.position.set(side * 0.89, 1.52, -0.5);
      cap.rotation.z = Math.PI / 2;
    }

    // Output slot on the upper front edge
    solid(body, slotGeometry, toon(palette.dayInk), OUTLINE_SMALL).position.set(0, 1.32, SLOT_Z);

    // Status light, front controls and badge
    const ledMaterial = track(
      materials,
      new three.MeshBasicMaterial({ color: new three.Color(palette.sun) }),
    );
    solid(body, ledGeometry, ledMaterial, OUTLINE_SMALL).position.set(-0.85, 1.0, 0.86);
    const buttons: [number, string][] = [
      [0.5, palette.amber],
      [0.85, palette.cream],
    ];
    for (const [x, color] of buttons) {
      const button = solid(body, buttonGeometry, toon(color), OUTLINE_SMALL);
      button.position.set(x, 1.0, 0.87);
      button.rotation.z = Math.PI / 2;
    }
    const badge = solid(body, badgeGeometry, toon(palette.amber), OUTLINE_SMALL);
    badge.position.set(0, 0.5, 0.86);
    badge.rotation.x = Math.PI / 2;

    // Four squashed-sphere feet
    for (const fx of [-0.85, 0.85]) {
      for (const fz of [-0.6, 0.6]) {
        const foot = solid(printer, footGeometry, toon(palette.woodDark), OUTLINE_SMALL);
        foot.position.set(fx, 0.08, fz);
        foot.scale.set(1, 0.5, 1);
      }
    }

    // Ticket: front and back faces share one geometry; the back is mirrored so it reads from behind
    const paperGeometry = track(
      geometries,
      new three.PlaneGeometry(PAPER_W, paperH, 1, PAPER_ROWS),
    );
    const front = track(textures, new three.CanvasTexture(options.receipt));
    front.colorSpace = three.SRGBColorSpace;
    front.anisotropy = 4;
    const back = track(textures, new three.CanvasTexture(options.receipt));
    back.colorSpace = three.SRGBColorSpace;
    back.anisotropy = 4;
    back.wrapS = three.RepeatWrapping;
    back.repeat.set(-1, 1);
    back.offset.set(1, 0);
    // Unlit and not tone mapped, so the cream comes out as the exact texture colour; alphaTest
    // keeps the rounded corners and the torn edge clean
    const paperFace = (map: Texture, side: Side) =>
      track(
        materials,
        new three.MeshBasicMaterial({
          map,
          side,
          transparent: true,
          alphaTest: PAPER_ALPHA_TEST,
          toneMapped: false,
        }),
      );
    const paper = new three.Mesh(paperGeometry, paperFace(front, three.FrontSide));
    const paperBack = new three.Mesh(paperGeometry, paperFace(back, three.BackSide));
    // Vertices are moved on the CPU, so the first bounding sphere is meaningless
    paper.frustumCulled = false;
    paperBack.frustumCulled = false;
    paper.add(paperBack);

    printer.add(paper);

    // Contact shadow blob on the floor
    const shadowGeometry = track(geometries, new three.PlaneGeometry(1, 1));
    const shadowTex = track(textures, shadowTexture());
    const shadowMaterial = track(
      materials,
      new three.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    const shadow = new three.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.01, 0);

    // Warm twilight: sky-coloured fill, sun key and a sunset rim
    const fill = new three.HemisphereLight(
      new three.Color(palette.skyDawn),
      new three.Color(palette.woodDark),
      0.7,
    );
    const key = new three.DirectionalLight(new three.Color(palette.sun), 2.4);
    key.position.set(-3, 5, 4);
    const rim = new three.DirectionalLight(new three.Color(palette.sunSet), 1.2);
    rim.position.set(3, 2, -4);

    for (const root of [printer, shadow, fill, key, rim]) {
      scene.add(root);
      roots.push(root);
    }
    return { printer, body, paper, paperGeometry, shadow, ledMaterial };
  }

  let parts: Parts;
  try {
    parts = build();
  } catch (error) {
    // A half-built scene must not leak the GL context
    release();
    throw error;
  }
  const { printer, body, paper, paperGeometry, shadow, ledMaterial } = parts;
  const paperPositions = paperGeometry.getAttribute('position') as BufferAttribute;

  // Scratch values reused every frame
  const sunColor = new three.Color(palette.sun);
  const leafColor = new three.Color(palette.leaf);
  const ledColor = new three.Color();
  const pose: Pose = { y: 0, z: 0, angle: RISE };
  const rowY = new Float32Array(PAPER_ROWS + 1);
  const rowZ = new Float32Array(PAPER_ROWS + 1);
  const detachPos = new three.Vector3();
  const detachQuat = new three.Quaternion();
  const liftPos = new three.Vector3();
  const flyTarget = new three.Vector3();
  const camDir = new three.Vector3();
  let detachScale = 1;
  let detached = false;

  // Landing pose, recomputed whenever the target or the camera changes. The flattened ticket lies
  // tilted by (90 degrees - RISE) around X in its own frame, so the tilt is undone to face the camera
  const landPos = new three.Vector3();
  const landQuat = new three.Quaternion();
  const landDir = new three.Vector3();
  const landTilt = new three.Quaternion().setFromAxisAngle(
    new three.Vector3(1, 0, 0),
    -(Math.PI / 2 - RISE),
  );
  const landRect = { x: 0, y: 0, width: 0, height: 0 };
  const landViewport = { width: 0, height: 0 };
  let landScale = 1;
  let hasLanding = false;

  // Stands the ticket on the plane LAND_DISTANCE in front of the camera. Its projected width is
  // the target rect's width and its top edge sits on the rect's top; the projected height is then
  // the rect's too whenever the ticket has the card's aspect (always, short of the sanity cap)
  function computeLanding(): void {
    if (!hasLanding) return;
    // The landing is for the base camera, which is where the mouse sway ends up at fly = 1
    placeCamera(0);
    // Also refreshes the camera's world matrix, which unproject reads
    camera.getWorldDirection(camDir);
    // Pixel height of the plane at that width; its centre sits half of it below the rect's top
    const planeHeight = landRect.width * paperAspect;
    const ndcX = ((landRect.x + landRect.width / 2) / landViewport.width) * 2 - 1;
    const ndcY = 1 - ((landRect.y + planeHeight / 2) / landViewport.height) * 2;
    landDir.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    // Distance along the ray that reaches the plane (its depth along the view direction is D)
    landPos.copy(camera.position).addScaledVector(landDir, LAND_DISTANCE / landDir.dot(camDir));
    landQuat.copy(camera.quaternion).multiply(landTilt);
    const viewHeight = 2 * LAND_DISTANCE * Math.tan((FOV * DEG) / 2);
    // Pixels are square, so the viewport height gives the world size of one pixel at this depth
    landScale = ((landRect.width / landViewport.height) * viewHeight) / PAPER_W;
    // Back to the camera the current state asks for
    placeCamera(1 - clamp01(state.fly));
  }

  // Seats the ticket in the slot of the (possibly squashed) body
  function seatPaper(): void {
    paper.position.set(0, BODY_BASE + SLOT_TOP * body.scale.y, SLOT_Z);
    paper.quaternion.identity();
    paper.scale.setScalar(1);
  }

  // Moves every ticket row onto the paper path; fly recentres the ticket on its middle and
  // settles the flutter, so it lands perfectly flat
  function deformPaper(fedLength: number, curl: number, fly: number, time: number): void {
    const rows = PAPER_ROWS + 1;
    let sumY = 0;
    let sumZ = 0;
    for (let r = 0; r < rows; r++) {
      // Row 0 is the top of the ticket and leaves the slot first
      const d = (r / PAPER_ROWS) * paperH;
      writePose(Math.max(0, fedLength - d), fedLength, curl, time, pose, 1 - fly);
      rowY[r] = pose.y;
      rowZ[r] = pose.z;
      sumY += pose.y;
      sumZ += pose.z;
    }
    const offY = (fly * sumY) / rows;
    const offZ = (fly * sumZ) / rows;
    const half = PAPER_W / 2;
    for (let r = 0; r < rows; r++) {
      paperPositions.setXYZ(r * 2, -half, rowY[r] - offY, rowZ[r] - offZ);
      paperPositions.setXYZ(r * 2 + 1, half, rowY[r] - offY, rowZ[r] - offZ);
    }
    paperPositions.needsUpdate = true;
  }

  function apply(): void {
    if (disposed) return;
    const time = performance.now() / 1000;
    const pop = clamp01(state.pop);
    const feed = clamp01(state.feed);
    const squash = clamp01(state.squash);
    const cut = clamp01(state.cut);
    const fly = clamp01(state.fly);
    const exit = clamp01(state.exit);
    const bob = 0.5 + 0.5 * Math.sin(time * 1.6);

    // Mouse sway fades out as the ticket lands, so the camera is the base camera at fly = 1
    const sway = 1 - fly;
    placeCamera(sway);

    // Pop-in, float, wobble and squash; on exit the printer sinks, shrinks and is hidden
    const gone = exit >= 1;
    const exitScale = 1 - EXIT_SHRINK * exit;
    printer.visible = pop > 0 && !gone;
    shadow.visible = pop > 0 && !gone;
    printer.scale.setScalar((0.6 + 0.4 * pop) * exitScale);
    printer.position.y = -0.4 * (1 - pop) + FLOAT_BASE + FLOAT_AMP * bob - EXIT_SINK * exit;
    shadow.position.y = 0.01 - EXIT_SINK * exit;
    // The printer leans toward the pointer on top of its base turn
    printer.rotation.x = pointerY * PRINTER_PITCH * sway;
    printer.rotation.y = VIEW_TURN + pointerX * PRINTER_YAW * sway;
    printer.rotation.z = Math.max(-1, Math.min(1, state.jitter)) * JITTER_MAX;
    body.scale.set(1 + 0.015 * squash, 1 - 0.03 * squash, 1 + 0.015 * squash);
    const shadowK = (0.6 + 0.4 * pop) * (1 - 0.12 * bob) * exitScale;
    shadow.scale.set(3.4 * shadowK, 2.6 * shadowK, 1);

    // Status light: sun while printing, leaf when done, dim when off
    ledColor.copy(sunColor).lerp(leafColor, clamp01(state.ledDone));
    ledMaterial.color.copy(ledColor).multiplyScalar(0.12 + 0.88 * clamp01(state.ledOn));

    // Ticket: fed length and curl, which eases to flat while it flies
    const fedLength = feed * paperH;
    deformPaper(fedLength, clamp01(state.curl) * (1 - fly), fly, time);
    paper.visible = feed > 0;

    if (cut > 0) {
      if (!detached) {
        // Keep the world transform while the ticket leaves the printer's hierarchy
        seatPaper();
        scene.attach(paper);
        detached = true;
        detachPos.copy(paper.position);
        detachQuat.copy(paper.quaternion);
        detachScale = paper.scale.x;
      }
      liftPos.copy(detachPos);
      liftPos.y += CUT_LIFT * cut;
      if (fly > 0 && hasLanding) {
        // Glide to the landing pose, ending parallel to the screen at the target's size
        paper.position.lerpVectors(liftPos, landPos, fly);
        paper.quaternion.slerpQuaternions(detachQuat, landQuat, fly);
        paper.scale.setScalar(detachScale + (landScale - detachScale) * fly);
      } else if (fly > 0) {
        // Nowhere to land: face the camera and slide to just behind it
        camera.getWorldDirection(camDir);
        flyTarget.copy(camera.position).addScaledVector(camDir, -FLY_PAST);
        paper.position.lerpVectors(liftPos, flyTarget, fly);
        paper.quaternion.slerpQuaternions(detachQuat, camera.quaternion, fly);
        paper.scale.setScalar(detachScale * (1 + FLY_SCALE * fly));
      } else {
        paper.position.copy(liftPos);
        paper.quaternion.copy(detachQuat);
        paper.scale.setScalar(detachScale);
      }
    } else {
      // Timeline rewound: hand the ticket back to the printer
      if (detached) {
        printer.add(paper);
        detached = false;
      }
      seatPaper();
    }
  }

  // First render must already look right
  camera.updateProjectionMatrix();
  apply();

  return {
    state,

    resize(width, height) {
      if (disposed || !(width > 0 && height > 0)) return;
      const aspect = width / height;
      renderer.setPixelRatio(options.dpr);
      // false leaves the canvas CSS size alone; the stylesheet owns it
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      baseZ = cameraZ(aspect);
      placeCamera(1 - clamp01(state.fly));
      camera.updateProjectionMatrix();
      // The camera moved, so the landing pose moves with it
      computeLanding();
      apply();
    },

    setLanding(rect, viewport) {
      if (disposed) return;
      // Null, or a rect or viewport without area, means fly past the camera instead
      hasLanding =
        !!rect && rect.width > 0 && rect.height > 0 && viewport.width > 0 && viewport.height > 0;
      if (rect && hasLanding) {
        landRect.x = rect.x;
        landRect.y = rect.y;
        landRect.width = rect.width;
        landRect.height = rect.height;
        landViewport.width = viewport.width;
        landViewport.height = viewport.height;
      }
      computeLanding();
    },

    setPointer(x, y) {
      // Not-a-number would poison the camera, so it counts as centred
      pointerX = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
      pointerY = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
    },

    apply,

    render() {
      if (disposed) return;
      renderer.render(scene, camera);
    },

    dispose: release,
  };
}

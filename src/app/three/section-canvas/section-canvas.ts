import { Component, ElementRef, OnDestroy, afterNextRender, input, viewChild } from '@angular/core';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  Texture,
  TorusKnotGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { motionAllowed } from '../../shared/motion';

// A self-contained WebGL canvas for a single section: its own renderer, scene,
// camera and render loop. Because the canvas lives inside its section in the DOM,
// the object is aligned to that section for free and can never leave it - no
// scroll-to-world maths, no anchoring. A local, scroll-linked camera orbit gives
// the object a contained cinematic reveal as its section passes through the viewport.
// The render loop only runs while the section is on screen (IntersectionObserver),
// so off-screen sections cost no GPU time or per-frame layout.
const ORBIT_R = 6; // camera orbit radius within the section
// Kept small: a wide swing around an off-centre object made it wobble across the frame
const ORBIT_RANGE = 0.35; // radians the camera swings as the section crosses the viewport
const SWAY = 0.25; // vertical camera sway
// How quickly the camera catches up with the scroll position each frame (0..1). Easing
// it stops mouse-wheel steps from making the object jump in jerky increments.
const SCROLL_EASE = 0.08;
const SPIN_PER_SECOND = 0.6; // radians per second the object turns (about 0.01 per frame at 60Hz)
const RIGHT_FRAC = 0.55; // how far toward the right edge the object sits when aligned right (0 = centre, 1 = edge)

// 'bottles' variant: three copies of the model at different depths, each with its own scroll strength
const BOTTLES_FOV = 35;
const BOTTLES_CAMERA_Z = 12;
const BOTTLE_UNIT_HEIGHT = 5; // every copy is normalised to this height (world units) before scaling
const BOTTLE_HALF_HEIGHT = BOTTLE_UNIT_HEIGHT / 2;
const BOTTLE_SPIN_STILL = 0.4; // fixed turn used for the single still frame under reduced motion
const BOTTLE_LEAN_MAX = 0.15; // the scroll-linked lean never exceeds this (radians)
const BOTTLE_FIT_W = 0.8; // a bottle is never wider than this share of the visible half width
const BOTTLE_MARGIN = 0.25; // world units kept clear of the canvas edge
const NARROW_PX = 820; // below this canvas width only the front bottle shows, behind the dimmed copy
const NARROW_SHIFT = -0.45; // share of the visible half width they slide by

// x and y place each bottle as a share of the visible frame at its depth (-1 left/bottom edge,
// 1 right/top edge), so the spacing holds at any canvas width. height is the share of the
// frame's height the bottle fills, z its depth, travel how far it moves each way over the scroll
// (share of the frame's half height; negative moves the opposite way), tilt its lean (radians)
// and spin its turn (radians per second)
interface BottleSlot {
  x: number;
  y: number;
  z: number;
  height: number;
  travel: number;
  tilt: number;
  spin: number;
}
const BOTTLE_SLOTS: BottleSlot[] = [
  // Front bottle, centred in the free right half (the copy covers the left half); moves the most
  { x: 0.5, y: -0.05, z: 0, height: 0.5, travel: 0.45, tilt: -0.08, spin: 0.25 },
  // Smaller one high on the far right; moves about half as far
  { x: 0.88, y: 0.3, z: -3.5, height: 0.36, travel: 0.22, tilt: 0.14, spin: -0.18 },
  // Smallest one low, between the copy and the front bottle; drifts slightly the other way,
  // so the layers pull apart as the section scrolls
  { x: 0.14, y: -0.35, z: -6, height: 0.26, travel: -0.12, tilt: 0.22, spin: 0.12 },
];

// Half-profile of a plain glass bottle (radius, height), spun into a solid by LatheGeometry.
// Generic shape only: no label, embossing or brand detail.
const BOTTLE_PROFILE: [number, number][] = [
  [0, -1.35],
  [0.5, -1.35],
  [0.58, -1.27],
  [0.6, -1.1],
  [0.6, 0.15],
  [0.56, 0.42],
  [0.42, 0.68],
  [0.26, 0.92],
  [0.21, 1.12],
  [0.21, 1.28],
  [0, 1.28],
];

@Component({
  selector: 'app-section-canvas',
  templateUrl: './section-canvas.html',
})
export class SectionCanvas implements OnDestroy {
  // Which mesh to show, and its colour
  // 'bottles' shows three copies of the model (or the built-in bottle) at different depths
  readonly variant = input<'cube' | 'knot' | 'bottle' | 'bottles'>('cube');
  readonly color = input('#f0a500');
  // Horizontal placement: 'center' keeps the object at the origin, 'right' pins it
  // to the right of the frame at a constant screen fraction, whatever the aspect.
  readonly align = input<'center' | 'right'>('center');
  // Optional GLB (bottle variant only): its first mesh, with its own material and texture,
  // replaces the built-in bottle once loaded. The built-in shape shows until then and stays
  // if loading fails. Cameras and lights inside the file are ignored.
  // In the 'bottles' variant the whole model is used instead, normalised and cloned per bottle.
  readonly model = input<string>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private object?: Object3D;
  // 'bottles' variant: each pivot is placed and leaned per frame; its holder carries the model
  private bottles: { slot: BottleSlot; pivot: Group; holder: Group }[] = [];
  // Horizontal radius of one 5-unit-tall bottle, used to keep it inside the frame
  private bottleHalfWidth = 0.8;
  private frameId?: number;
  // Set under reduced motion: draws the single still frame again after a resize
  private redraw?: () => void;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private readonly disposables: { dispose(): void }[] = [];
  // Guards the async model load from landing after teardown
  private destroyed = false;

  constructor() {
    // Browser-only: WebGL + the render loop never run during prerender/SSR
    afterNextRender(() => this.init());
  }

  private init(): void {
    const el = this.host().nativeElement;

    // Bail gracefully where WebGL is unavailable (headless/test/unsupported)
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // Reduced motion: no spin and no scroll-linked motion; one still frame, re-drawn only
    // when the canvas resizes (or the model lands)
    const still = !motionAllowed();
    const multi = this.variant() === 'bottles';

    const scene = new Scene();
    const camera = new PerspectiveCamera(multi ? BOTTLES_FOV : 45, this.aspect(el), 0.1, 100);
    if (multi) camera.position.set(0, 0, BOTTLES_CAMERA_Z);
    this.camera = camera;

    // Warm key over soft ambient, cool rim (the bottles use a stronger set, tuned in the mockup)
    scene.add(new AmbientLight(0xffffff, multi ? 0.6 : 0.55));
    const key = new DirectionalLight(0xffd9a0, multi ? 1.8 : 1.5);
    key.position.set(4, 5, 6);
    scene.add(key);
    const rim = new PointLight(0x7fb0ff, multi ? 30 : 0.7, 40);
    rim.position.set(-5, -2, 5);
    scene.add(rim);

    // The single object, centred at the origin of this section's scene; or the group of bottles
    let object: Object3D | undefined;
    if (multi) {
      this.buildBottles(scene, still);
    } else {
      object = this.buildObject();
      scene.add(object);
      this.object = object;
    }

    // Keep the canvas matched to the section as it (or its content) resizes
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(el);

    let last = performance.now();
    // Eased scroll progress; starts unset so the first frame lands on the true position
    let eased: number | undefined;

    const draw = () => {
      // Local scroll progress: 0 as the section enters, 1 as it leaves (fixed mid-way when still),
      // eased toward its target so the camera glides rather than stepping with the wheel
      const rect = el.getBoundingClientRect();
      const target = Math.min(
        1,
        Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)),
      );
      eased = eased === undefined ? target : eased + (target - eased) * SCROLL_EASE;
      const p = still ? 0.5 : eased;

      // The bottles are placed per frame from this progress; the camera stays put
      if (multi) {
        this.layoutBottles(scene, camera, el, p);
        renderer.render(scene, camera);
        return;
      }
      if (!object) return;

      // Camera orbits within the section as it crosses the viewport
      const theta = (p - 0.5) * ORBIT_RANGE;
      camera.position.set(
        ORBIT_R * Math.sin(theta),
        Math.sin(p * Math.PI) * SWAY,
        ORBIT_R * Math.cos(theta),
      );
      camera.lookAt(0, 0, 0);

      // Offset the object to the right of the frame, scaled by aspect so it holds
      // the same screen position from wide desktop down to a narrow phone.
      const halfExtent = Math.tan((camera.fov * Math.PI) / 180 / 2) * ORBIT_R;
      object.position.x = this.align() === 'right' ? RIGHT_FRAC * halfExtent * camera.aspect : 0;

      renderer.render(scene, camera);
    };
    this.redraw = still ? draw : undefined;

    const renderFrame = (now: number) => {
      // Spin by elapsed time so the speed is the same at 60Hz and 120Hz
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (object) object.rotation.y += SPIN_PER_SECOND * dt;
      for (const { slot, pivot } of this.bottles) pivot.rotation.y += slot.spin * dt;
      draw();
      this.frameId = requestAnimationFrame(renderFrame);
    };

    // Run the loop only while the section is on screen; pause it otherwise
    const start = () => {
      if (still) return draw();
      last = performance.now();
      if (this.frameId === undefined) this.frameId = requestAnimationFrame(renderFrame);
    };
    const stop = () => {
      if (this.frameId !== undefined) {
        cancelAnimationFrame(this.frameId);
        this.frameId = undefined;
      }
    };
    this.visibilityObserver = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? start() : stop(),
    );
    this.visibilityObserver.observe(el);
  }

  // Builds the mesh (or small group of meshes) for the chosen variant and tracks what
  // needs disposing on teardown
  private buildObject(): Object3D {
    const color = new Color(this.color());
    if (this.variant() === 'bottle') {
      // Slightly tilted so the shoulder catches the key light
      const { bottle, lathe, cap } = this.buildBottleBody();
      bottle.rotation.z = -0.22;
      const url = this.model();
      if (url) void this.loadBottleModel(url, bottle, lathe, cap);
      return bottle;
    }

    const geometry =
      this.variant() === 'knot'
        ? new TorusKnotGeometry(0.9, 0.32, 160, 20)
        : new BoxGeometry(1.8, 1.8, 1.8);
    const material = new MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.12 });
    this.disposables.push(geometry, material);
    return new Mesh(geometry, material);
  }

  // The built-in bottle: green glass body plus a plain metal cap. Opaque on purpose: a
  // transparent lathe re-sorts its faces as it spins and visibly shimmers.
  private buildBottleBody(): { bottle: Group; lathe: Mesh; cap: Mesh } {
    const body = new LatheGeometry(
      BOTTLE_PROFILE.map(([r, y]) => new Vector2(r, y)),
      64,
    );
    const glass = new MeshPhysicalMaterial({
      color: new Color(this.color()),
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    const capGeometry = new CylinderGeometry(0.23, 0.23, 0.26, 48);
    const capMaterial = new MeshStandardMaterial({
      color: 0xc9cfc8,
      roughness: 0.35,
      metalness: 0.8,
    });
    const cap = new Mesh(capGeometry, capMaterial);
    cap.position.y = 1.4;

    const lathe = new Mesh(body, glass);
    const bottle = new Group();
    bottle.add(lathe, cap);
    this.disposables.push(body, glass, capGeometry, capMaterial);
    return { bottle, lathe, cap };
  }

  // 'bottles' variant: one pivot per slot, each holding a copy of the built-in bottle until
  // the model loads (and for good if it never does)
  private buildBottles(scene: Scene, still: boolean): void {
    const { bottle } = this.buildBottleBody();
    const { unit, halfWidth } = this.normalise(bottle);
    this.bottleHalfWidth = halfWidth;
    for (const slot of BOTTLE_SLOTS) {
      const holder = new Group();
      this.fillHolder(holder, unit);
      const pivot = new Group();
      pivot.add(holder);
      // Real size and position are set by layoutBottles on every frame
      pivot.position.set(0, 0, slot.z);
      pivot.rotation.z = slot.tilt;
      // Still frame: a fixed, slightly turned view instead of a spin
      if (still) pivot.rotation.y = BOTTLE_SPIN_STILL;
      scene.add(pivot);
      this.bottles.push({ slot, pivot, holder });
    }
    const url = this.model();
    if (url) void this.loadBottlesModel(url);
  }

  // Centres a model on its middle and scales it to BOTTLE_UNIT_HEIGHT tall, so the layout maths
  // can treat every bottle alike. Also returns its horizontal reach (half the footprint
  // diagonal, so a spinning bottle is covered whatever its turn).
  private normalise(src: Object3D): { unit: Group; halfWidth: number } {
    // Child transforms must be current before measuring, or the box ignores the file's root scale
    src.updateMatrixWorld(true);
    const box = new Box3().setFromObject(src);
    const size = box.getSize(new Vector3());
    if (!(size.y > 0)) throw new Error('Bottle model has no height');
    src.position.sub(box.getCenter(new Vector3()));
    const unit = new Group();
    unit.add(src);
    const k = BOTTLE_UNIT_HEIGHT / size.y;
    unit.scale.setScalar(k);
    return { unit, halfWidth: (Math.hypot(size.x, size.z) / 2) * k };
  }

  // Puts a clone of the normalised bottle in a holder, replacing what was there. Clones share
  // geometry and materials, so nothing extra needs disposing.
  private fillHolder(holder: Group, unit: Group): void {
    holder.clear();
    holder.add(unit.clone());
  }

  // Loads the whole model once and swaps it into every bottle. Keeps the built-in bottles when
  // the model can't load (offline, 404, parse error).
  private async loadBottlesModel(url: string): Promise<void> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      const root = gltf.scene;

      // Cameras and lights inside the file are ignored; the scene has its own
      const extras: Object3D[] = [];
      root.traverse((node) => {
        if ('isLight' in node || 'isCamera' in node) extras.push(node);
      });
      for (const node of extras) node.removeFromParent();

      // Measure first: if the model is unusable this throws before any resources are collected
      const { unit, halfWidth } = this.normalise(root);
      const resources = this.collectResources(root);
      if (this.destroyed) {
        for (const d of resources) d.dispose();
        return;
      }
      this.disposables.push(...resources);
      this.bottleHalfWidth = halfWidth;
      for (const { holder } of this.bottles) this.fillHolder(holder, unit);
      this.redraw?.();
    } catch {
      // Keep the built-in bottles
    }
  }

  // Everything in a loaded model that holds GPU memory, with its textures sharpened at glancing angles
  private collectResources(root: Object3D): { dispose(): void }[] {
    const found = new Set<{ dispose(): void }>();
    const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      found.add(node.geometry);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        found.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture) {
            value.anisotropy = anisotropy;
            value.needsUpdate = true;
            found.add(value);
          }
        }
      }
    });
    return [...found];
  }

  // Places and leans every bottle for this scroll progress and keeps each one fully inside the
  // canvas: measures the visible half height and width at the bottle's depth, shrinks it to
  // fit, then clamps its position so even its reach (tilt, spin, lean, perspective) stays in frame
  private layoutBottles(scene: Scene, camera: PerspectiveCamera, el: HTMLElement, p: number): void {
    // Narrow canvases (phones) show only the front bottle, centred behind the dimmed copy, as the
    // section did before the three-bottle layout
    const narrow = el.clientWidth < NARROW_PX;
    const shift = narrow ? NARROW_SHIFT : 0;

    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const hw = this.bottleHalfWidth;
    for (const [index, { slot, pivot }] of this.bottles.entries()) {
      pivot.visible = !narrow || index === 0;
      if (!pivot.visible) continue;
      // Visible half height and width of the frame at this bottle's depth
      const dist = camera.position.z - slot.z;
      const halfH = tanHalf * dist;
      const halfW = halfH * camera.aspect;

      // Extent of a unit-scale bottle: the tilted top sweeps a circle as it spins, the lean
      // tips it toward the camera, and nearer parts look bigger (scale is the upper bound)
      const tilt = Math.abs(slot.tilt);
      const reach = hw + BOTTLE_HALF_HEIGHT * Math.sin(tilt);
      const perspective = dist / Math.max(dist - reach, dist * 0.5);
      const unitW = reach * perspective;
      const unitH =
        (BOTTLE_HALF_HEIGHT * Math.cos(tilt) +
          hw * Math.sin(tilt) +
          reach * Math.sin(BOTTLE_LEAN_MAX)) *
        perspective;

      // Size from its share of the frame height, never wider than the frame allows, and small
      // enough that its full scroll travel still fits, so no bottle ever gets cut off
      const travel = Math.abs(slot.travel) * halfH;
      const fit = Math.min(
        (halfH * slot.height) / unitH,
        (halfW * BOTTLE_FIT_W) / unitW,
        Math.max(0, halfH - travel - BOTTLE_MARGIN) / unitH,
      );
      pivot.scale.setScalar(fit);
      const roomY = Math.max(0, halfH - unitH * fit - BOTTLE_MARGIN);
      const roomX = Math.max(0, halfW - unitW * fit - BOTTLE_MARGIN);

      // Each bottle moves by its own strength: the rest height leaves room for the whole travel,
      // so none stalls against the clamp, and the layers drift apart at different rates
      const reachY = Math.min(travel, roomY);
      const rest = MathUtils.clamp(slot.y * halfH, -(roomY - reachY), roomY - reachY);
      const y = rest + (p - 0.5) * -2 * reachY * Math.sign(slot.travel);
      pivot.position.y = MathUtils.clamp(y, -roomY, roomY);
      pivot.position.x = MathUtils.clamp((slot.x + shift) * halfW, -roomX, roomX);
      // Small lean only, so it never pushes the cap past the margin
      pivot.rotation.x = MathUtils.clamp(
        (p - 0.5) * 2.4 * slot.travel,
        -BOTTLE_LEAN_MAX,
        BOTTLE_LEAN_MAX,
      );
    }
  }

  // Swaps the built-in bottle for the GLB's mesh, with its own textured material, scaled to
  // the same height and resting on the same base. Loader is imported lazily so pages
  // without a model don't ship it.
  private async loadBottleModel(url: string, bottle: Group, lathe: Mesh, cap: Mesh): Promise<void> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(url);
      if (this.destroyed) return;
      let source: Mesh | undefined;
      gltf.scene.traverse((node) => {
        if (!source && node instanceof Mesh) source = node;
      });
      if (!source) return;

      // Fit the model to the built-in bottle's height and base
      const geometry = source.geometry.clone();
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const height = box.max.y - box.min.y;
      const targetHeight = BOTTLE_PROFILE[BOTTLE_PROFILE.length - 1][1] - BOTTLE_PROFILE[0][1];
      const scale = targetHeight / height;
      geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      geometry.scale(scale, scale, scale);
      geometry.translate(0, BOTTLE_PROFILE[0][1], 0);
      this.disposables.push(geometry);

      // Keep the model's own material (its painted texture); sharpen the texture at glancing
      // angles so the label stays crisp, and release both with the rest on teardown
      const materials = Array.isArray(source.material) ? source.material : [source.material];
      for (const material of materials) {
        this.disposables.push(material);
        if (material instanceof MeshStandardMaterial && material.map) {
          material.map.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
          material.map.needsUpdate = true;
          this.disposables.push(material.map);
        }
      }

      // The model already has a cap, so the built-in one goes
      bottle.remove(lathe, cap);
      lathe.geometry.dispose();
      bottle.add(new Mesh(geometry, source.material));
      // Stand the real model upright, as it's authored; the tilt only flattered the built-in shape
      bottle.rotation.z = 0;
      this.redraw?.();
    } catch {
      // Keep the built-in bottle when the model can't load (offline, 404, parse error)
    }
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const el = this.host().nativeElement;
    this.camera.aspect = this.aspect(el);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.redraw?.();
  }

  private aspect(el: HTMLElement): number {
    return el.clientHeight > 0 ? el.clientWidth / el.clientHeight : 1;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // Stop the loop, drop the observers, release this canvas's GPU + DOM resources
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    for (const d of this.disposables) d.dispose();
    // Free the GPU context now rather than waiting for garbage collection
    this.renderer?.forceContextLoss();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

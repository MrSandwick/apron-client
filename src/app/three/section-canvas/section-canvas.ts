import { Component, ElementRef, OnDestroy, afterNextRender, input, viewChild } from '@angular/core';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  TorusKnotGeometry,
  Vector2,
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

// Half-profile of a plain glass bottle (radius, height), spun into a solid by LatheGeometry.
// Generic shape only: no label, embossing or brand detail.
const BOTTLE_PROFILE: [number, number][] = [
  [0, -1.35], [0.5, -1.35], [0.58, -1.27], [0.6, -1.1], [0.6, 0.15], [0.56, 0.42],
  [0.42, 0.68], [0.26, 0.92], [0.21, 1.12], [0.21, 1.28], [0, 1.28],
];

@Component({
  selector: 'app-section-canvas',
  templateUrl: './section-canvas.html',
})
export class SectionCanvas implements OnDestroy {
  // Which mesh to show, and its colour
  readonly variant = input<'cube' | 'knot' | 'bottle'>('cube');
  readonly color = input('#f0a500');
  // Horizontal placement: 'center' keeps the object at the origin, 'right' pins it
  // to the right of the frame at a constant screen fraction, whatever the aspect.
  readonly align = input<'center' | 'right'>('center');
  // Optional GLB (bottle variant only): its first mesh, with its own material and texture,
  // replaces the built-in bottle once loaded. The built-in shape shows until then and stays
  // if loading fails. Cameras and lights inside the file are ignored.
  readonly model = input<string>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private object?: Object3D;
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

    const scene = new Scene();
    const camera = new PerspectiveCamera(45, this.aspect(el), 0.1, 100);
    this.camera = camera;

    // Warm key over soft ambient, cool rim
    scene.add(new AmbientLight(0xffffff, 0.55));
    const key = new DirectionalLight(0xffd9a0, 1.5);
    key.position.set(4, 5, 6);
    scene.add(key);
    const rim = new PointLight(0x7fb0ff, 0.7, 40);
    rim.position.set(-5, -2, 5);
    scene.add(rim);

    // The single object, centred at the origin of this section's scene
    const object = this.buildObject();
    scene.add(object);
    this.object = object;

    // Keep the canvas matched to the section as it (or its content) resizes
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(el);

    // Reduced motion: no spin and no scroll-linked orbit; one still frame from the
    // centre of the orbit, re-drawn only when the canvas resizes
    const still = !motionAllowed();
    let last = performance.now();
    // Eased scroll progress; starts unset so the first frame lands on the true position
    let eased: number | undefined;

    const draw = () => {
      // Local scroll progress: 0 as the section enters, 1 as it leaves (fixed mid-way when still),
      // eased toward its target so the camera glides rather than stepping with the wheel
      const rect = el.getBoundingClientRect();
      const target = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
      eased = eased === undefined ? target : eased + (target - eased) * SCROLL_EASE;
      const p = still ? 0.5 : eased;

      // Camera orbits within the section as it crosses the viewport
      const theta = (p - 0.5) * ORBIT_RANGE;
      camera.position.set(ORBIT_R * Math.sin(theta), Math.sin(p * Math.PI) * SWAY, ORBIT_R * Math.cos(theta));
      camera.lookAt(0, 0, 0);

      // Offset the object to the right of the frame, scaled by aspect so it holds
      // the same screen position from wide desktop down to a narrow phone.
      const halfExtent = Math.tan(((camera.fov * Math.PI) / 180) / 2) * ORBIT_R;
      object.position.x = this.align() === 'right' ? RIGHT_FRAC * halfExtent * camera.aspect : 0;

      renderer.render(scene, camera);
    };
    this.redraw = still ? draw : undefined;

    const renderFrame = (now: number) => {
      // Spin by elapsed time so the speed is the same at 60Hz and 120Hz
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      object.rotation.y += SPIN_PER_SECOND * dt;
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
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
    );
    this.visibilityObserver.observe(el);
  }

  // Builds the mesh (or small group of meshes) for the chosen variant and tracks what
  // needs disposing on teardown
  private buildObject(): Object3D {
    const color = new Color(this.color());
    if (this.variant() === 'bottle') {
      // Green glass body, slightly tilted so the shoulder catches the key light. Opaque on
      // purpose: a transparent lathe re-sorts its faces as it spins and visibly shimmers.
      const body = new LatheGeometry(BOTTLE_PROFILE.map(([r, y]) => new Vector2(r, y)), 64);
      const glass = new MeshPhysicalMaterial({
        color,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      // Plain metal cap
      const capGeometry = new CylinderGeometry(0.23, 0.23, 0.26, 48);
      const capMaterial = new MeshStandardMaterial({ color: 0xc9cfc8, roughness: 0.35, metalness: 0.8 });
      const cap = new Mesh(capGeometry, capMaterial);
      cap.position.y = 1.4;

      const lathe = new Mesh(body, glass);
      const bottle = new Group();
      bottle.add(lathe, cap);
      bottle.rotation.z = -0.22;
      this.disposables.push(body, glass, capGeometry, capMaterial);
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
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

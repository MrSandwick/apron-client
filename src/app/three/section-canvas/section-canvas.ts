import { Component, ElementRef, OnDestroy, afterNextRender, input, viewChild } from '@angular/core';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  TorusKnotGeometry,
  WebGLRenderer,
} from 'three';

// A self-contained WebGL canvas for a single section: its own renderer, scene,
// camera and render loop. Because the canvas lives inside its section in the DOM,
// the object is aligned to that section for free and can never leave it - no
// scroll-to-world maths, no anchoring. A local, scroll-linked camera orbit gives
// the object a contained cinematic reveal as its section passes through the viewport.
// The render loop only runs while the section is on screen (IntersectionObserver),
// so off-screen sections cost no GPU time or per-frame layout.
const ORBIT_R = 6; // camera orbit radius within the section
const ORBIT_RANGE = 1.3; // radians the camera swings as the section crosses the viewport
const SWAY = 1.2; // vertical camera sway
const RIGHT_FRAC = 0.55; // how far toward the right edge the object sits when aligned right (0 = centre, 1 = edge)

@Component({
  selector: 'app-section-canvas',
  templateUrl: './section-canvas.html',
})
export class SectionCanvas implements OnDestroy {
  // Which mesh to show, and its colour
  readonly variant = input<'cube' | 'knot'>('cube');
  readonly color = input('#f0a500');
  // Horizontal placement: 'center' keeps the object at the origin, 'right' pins it
  // to the right of the frame at a constant screen fraction, whatever the aspect.
  readonly align = input<'center' | 'right'>('center');

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private object?: Mesh;
  private frameId?: number;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private readonly disposables: { dispose(): void }[] = [];

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
    const geometry =
      this.variant() === 'knot'
        ? new TorusKnotGeometry(0.9, 0.32, 160, 20)
        : new BoxGeometry(1.8, 1.8, 1.8);
    const material = new MeshStandardMaterial({
      color: new Color(this.color()),
      roughness: 0.32,
      metalness: 0.12,
    });
    const object = new Mesh(geometry, material);
    scene.add(object);
    this.object = object;
    this.disposables.push(geometry, material);

    // Keep the canvas matched to the section as it (or its content) resizes
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(el);

    const renderFrame = () => {
      // Local scroll progress: 0 as the section enters, 1 as it leaves
      const rect = el.getBoundingClientRect();
      const p = Math.min(
        1,
        Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)),
      );

      // Camera orbits within the section as it crosses the viewport
      const theta = (p - 0.5) * ORBIT_RANGE;
      camera.position.set(ORBIT_R * Math.sin(theta), Math.sin(p * Math.PI) * SWAY, ORBIT_R * Math.cos(theta));
      camera.lookAt(0, 0, 0);

      // Offset the object to the right of the frame, scaled by aspect so it holds
      // the same screen position from wide desktop down to a narrow phone.
      const halfExtent = Math.tan(((camera.fov * Math.PI) / 180) / 2) * ORBIT_R;
      object.position.x = this.align() === 'right' ? RIGHT_FRAC * halfExtent * camera.aspect : 0;

      object.rotation.y += 0.01;

      renderer.render(scene, camera);
      this.frameId = requestAnimationFrame(renderFrame);
    };

    // Run the loop only while the section is on screen; pause it otherwise
    const start = () => {
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

  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const el = this.host().nativeElement;
    this.camera.aspect = this.aspect(el);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  }

  private aspect(el: HTMLElement): number {
    return el.clientHeight > 0 ? el.clientWidth / el.clientHeight : 1;
  }

  ngOnDestroy(): void {
    // Stop the loop, drop the observers, release this canvas's GPU + DOM resources
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    for (const d of this.disposables) d.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

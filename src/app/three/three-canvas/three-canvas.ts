import { Component, ElementRef, OnDestroy, afterNextRender, viewChild } from '@angular/core';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

// Reusable Three.js canvas. All WebGL work runs browser-only (afterNextRender),
// so the component stays inert during prerender/SSR. Seeds the model pipeline (#30).
@Component({
  selector: 'app-three-canvas',
  templateUrl: './three-canvas.html',
})
export class ThreeCanvas implements OnDestroy {
  // Container the renderer's canvas is mounted into
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  // Live scene handles, created browser-side in initScene
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private frameId?: number;
  private resizeObserver?: ResizeObserver;

  // GPU resources to release on teardown (geometries, materials)
  private readonly disposables: { dispose(): void }[] = [];

  constructor() {
    // Browser-only: the WebGL context and render loop never run on the server
    afterNextRender(() => this.initScene());
  }

  // Stand up the renderer, camera, lights, and a proof mesh, then start the loop
  private initScene(): void {
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

    // Scene + camera framed on the origin
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, this.aspect(el), 0.1, 100);
    this.camera.position.set(0, 0, 4);

    // Warm key light over soft ambient, matching the brand palette
    const ambient = new AmbientLight(0xffffff, 0.6);
    const key = new DirectionalLight(0xffd9a0, 1.4);
    key.position.set(3, 4, 5);
    this.scene.add(ambient, key);

    // Proof mesh: a slowly rotating amber cube confirming the pipeline renders
    const geometry = new BoxGeometry(1.4, 1.4, 1.4);
    const material = new MeshStandardMaterial({
      color: new Color('#e8a33d'),
      roughness: 0.35,
      metalness: 0.1,
    });
    const cube = new Mesh(geometry, material);
    this.scene.add(cube);
    this.disposables.push(geometry, material);

    // Keep the canvas matched to its container as the layout changes
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(el);

    // Render loop
    const animate = () => {
      cube.rotation.x += 0.005;
      cube.rotation.y += 0.01;
      renderer.render(this.scene!, this.camera!);
      this.frameId = requestAnimationFrame(animate);
    };
    animate();
  }

  // Resync camera aspect and drawing buffer to the current container size
  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const el = this.host().nativeElement;
    this.camera.aspect = this.aspect(el);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
  }

  // Guard against a zero-height container producing a NaN aspect ratio
  private aspect(el: HTMLElement): number {
    return el.clientHeight > 0 ? el.clientWidth / el.clientHeight : 1;
  }

  ngOnDestroy(): void {
    // Stop the loop, drop observers, and release GPU + DOM resources
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    for (const d of this.disposables) d.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

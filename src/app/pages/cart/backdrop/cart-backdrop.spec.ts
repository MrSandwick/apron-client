import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackdropMood, BackdropScene, SceneFactory } from './backdrop-scene';
import { BACKDROP_SCENE } from './backdrop-token';
import { CartBackdrop } from './cart-backdrop';

interface FakeScene {
  resize: ReturnType<typeof vi.fn>;
  step: ReturnType<typeof vi.fn>;
  draw: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function fakeScene(): FakeScene {
  return { resize: vi.fn(), step: vi.fn(), draw: vi.fn(), dispose: vi.fn() };
}

// Every scene the factory produced, in creation order
let scenes: FakeScene[];

// Minimal 2D context: only what the host calls
function fakeContext() {
  return { setTransform: vi.fn(), clearRect: vi.fn() };
}

function stubGetContext(result: unknown): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => result) as never);
}

async function mount(
  inputs: { mood?: BackdropMood } = {},
): Promise<ComponentFixture<CartBackdrop>> {
  const fixture = TestBed.createComponent(CartBackdrop);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function tint(fixture: ComponentFixture<CartBackdrop>): HTMLElement {
  return fixture.nativeElement.querySelector('div.absolute') as HTMLElement;
}

describe('CartBackdrop', () => {
  beforeEach(() => {
    scenes = [];
    // The scene factory is replaced so the host is tested on its own
    const factory = vi.fn<SceneFactory>(() => {
      const scene = fakeScene();
      scenes.push(scene);
      // The fake only has the members the host calls, so it is cast to the scene contract
      return scene as unknown as BackdropScene;
    });
    TestBed.configureTestingModule({
      imports: [CartBackdrop],
      providers: [{ provide: BACKDROP_SCENE, useValue: factory }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is aria-hidden and renders a canvas', async () => {
    stubGetContext(null);
    const fixture = await mount();
    // Decorative layer must stay out of the accessibility tree
    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
  });

  // The backdrop eases in from transparent when it appears, and shows at once for reduced motion
  it('fades in slowly with motion and is shown directly without it', async () => {
    stubGetContext(null);
    const fixture = await mount();
    const classes = (fixture.nativeElement as HTMLElement).classList;
    expect(classes).toContain('motion-safe:animate-backdrop-in');
    expect(classes).not.toContain('opacity-0');
  });

  it('still renders and throws nothing when getContext returns null', async () => {
    stubGetContext(null);
    const fixture = await mount();
    expect(fixture.nativeElement.querySelector('canvas')).not.toBeNull();
    // No context means no scene is created
    expect(scenes).toHaveLength(0);
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('draws one still frame and never starts the loop under reduced motion', async () => {
    const ctx = fakeContext();
    stubGetContext(ctx);
    await mount();
    // Default test matchMedia stub reports no motion preference
    expect(scenes).toHaveLength(1);
    expect(scenes[0].draw).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalled();
    // Let real frames pass: a running loop would keep drawing, a still frame does not
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(scenes[0].draw).toHaveBeenCalledTimes(1);
  });

  // The preference can change while the page is open: the loop follows it
  it('stops the loop for a still frame and restarts it when reduced motion changes', async () => {
    stubGetContext(fakeContext());
    // matchMedia whose motion answer can be flipped, with the change listeners it was given
    let allowed = false;
    const listeners = new Set<() => void>();
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query.includes('no-preference') ? allowed : false;
          },
          media: query,
          addEventListener: (type: string, fn: () => void) => {
            if (type === 'change') listeners.add(fn);
          },
          removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
        }) as unknown as MediaQueryList,
    );
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(5);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const flip = (value: boolean) => {
      allowed = value;
      listeners.forEach((fn) => fn());
    };

    const fixture = await mount();
    // Reduced to begin with: one still frame, and the preference is being watched
    expect(scenes[0].draw).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);

    // Motion allowed: the loop starts (counted from here, so page-level frame requests do not count)
    const requestsBefore = raf.mock.calls.length;
    flip(true);
    expect(raf.mock.calls.length - requestsBefore).toBe(1);

    // Reduced again: the loop is cancelled and one still frame is drawn
    flip(false);
    expect(cancel).toHaveBeenCalledWith(5);
    expect(scenes[0].draw).toHaveBeenCalledTimes(2);

    // Destroying the page stops watching
    fixture.destroy();
    expect(listeners.size).toBe(0);
  });

  it('toggles the tint opacity and redraws once when mood changes', async () => {
    stubGetContext(fakeContext());
    const fixture = await mount();
    expect(tint(fixture).classList).toContain('opacity-0');

    // Cool mood fades the tint in and repaints the still frame
    fixture.componentRef.setInput('mood', 'cool');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(tint(fixture).classList).toContain('opacity-100');
    expect(tint(fixture).classList).not.toContain('opacity-0');
    expect(scenes[0].draw).toHaveBeenCalledTimes(2);
    const frame = scenes[0].draw.mock.calls[1][1];
    expect(frame.mood).toBe(1);
  });

  // Frame callbacks are collected so a test can step the loop by hand
  function manualLoop(): { tick(now: number): void } {
    let pending: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      pending = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    return {
      tick(now: number) {
        const cb = pending;
        pending = undefined;
        cb?.(now);
      },
    };
  }

  it('maps the pointer over the whole viewport to the parallax and eases toward it', async () => {
    stubGetContext(fakeContext());
    // Motion allowed with a fine pointer; the phone width query stays false so the frame is not throttled
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({ matches: !query.includes('max-width'), media: query }) as MediaQueryList,
    );
    const loop = manualLoop();
    await mount();
    const lastFrame = () => scenes[0].draw.mock.lastCall?.[1];

    // Pointer at the right edge: the target is +1, so px closes 8 percent of the gap per 16 ms
    loop.tick(0);
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: window.innerWidth,
        clientY: window.innerHeight / 2,
      }),
    );
    loop.tick(16);
    expect(lastFrame().px).toBeCloseTo(0.08, 2);
    // Vertical centre maps to zero apart from the small idle drift
    expect(Math.abs(lastFrame().py)).toBeLessThan(0.02);

    // It keeps closing the gap on later frames without overshooting
    let prev = lastFrame().px;
    for (let t = 32; t <= 320; t += 16) {
      loop.tick(t);
      expect(lastFrame().px).toBeGreaterThan(prev);
      expect(lastFrame().px).toBeLessThanOrEqual(1);
      prev = lastFrame().px;
    }

    // The left edge maps to -1
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
    for (let t = 336; t <= 2400; t += 16) loop.tick(t);
    expect(lastFrame().px).toBeLessThan(-0.8);
    expect(lastFrame().py).toBeLessThan(-0.8);
  });

  it('follows the scroll position instead of the pointer on touch devices', async () => {
    stubGetContext(fakeContext());
    // Motion allowed, no fine pointer
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({ matches: !query.includes('pointer: fine'), media: query }) as MediaQueryList,
    );
    const windowAdd = vi.spyOn(window, 'addEventListener');
    manualLoop();
    await mount();
    const types = windowAdd.mock.calls.map((c) => c[0]);
    expect(types).toContain('scroll');
    expect(types).not.toContain('pointermove');
  });

  it('removes its listeners and disconnects observers on destroy', async () => {
    stubGetContext(fakeContext());

    // Motion allowed with a fine pointer, so the loop and listeners are set up
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: true, media: query }) as MediaQueryList,
    );
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const resizeDisconnect = vi.fn();
    const intersectionDisconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = resizeDisconnect;
      },
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        disconnect = intersectionDisconnect;
      },
    );
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');

    const fixture = await mount();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    fixture.destroy();

    expect(windowRemove).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(cancel).toHaveBeenCalledWith(7);
    expect(resizeDisconnect).toHaveBeenCalled();
    expect(intersectionDisconnect).toHaveBeenCalled();
    // The scene and the canvas bitmap are released
    expect(scenes[0].dispose).toHaveBeenCalled();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});

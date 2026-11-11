import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroPalette, PrinterIntroScene, initialIntroState } from './intro-contract';
import { CartPrinterIntro } from './printer-intro';
import { PRINTER_INTRO_DEPS, PrinterIntroDeps, RoundedBox, Three } from './printer-intro-deps';
import { CardTexture } from './receipt-texture';
import { resetWebglProbe } from './webgl';

interface FakeScene {
  state: ReturnType<typeof initialIntroState>;
  resize: ReturnType<typeof vi.fn>;
  setLanding: ReturnType<typeof vi.fn>;
  setPointer: ReturnType<typeof vi.fn>;
  apply: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function fakeScene(): FakeScene {
  return {
    state: initialIntroState(),
    resize: vi.fn(),
    setLanding: vi.fn(),
    setPointer: vi.fn(),
    apply: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
}

let scenes: FakeScene[];

// The scene factory and the card texture are stand-ins, so the host is tested alone
const factory = vi.fn<PrinterIntroDeps['createScene']>();
const texture = vi.fn<PrinterIntroDeps['createCardTexture']>();

// Three, the rounded box and the palette are placeholders; gsap is the real one the timeline needs
const deps: PrinterIntroDeps = {
  loadLibs: () =>
    Promise.resolve({
      three: {} as Three,
      roundedBox: class {} as unknown as RoundedBox,
      gsap,
    }),
  createScene: factory,
  readPalette: () => ({}) as IntroPalette,
  createCardTexture: texture,
};

// jsdom has no WebGL: the availability probe gets a fake context, or none
function stubWebgl(available: boolean): void {
  const gl = { getExtension: () => null };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    available && type === 'webgl2' ? gl : null) as never);
}

// The default test matchMedia never matches; this one allows motion
function allowMotion(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: true, media: query }) as MediaQueryList,
  );
}

// Motion allowed, and a fine pointer only when asked for
function allowMotionWithPointer(fine: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({ matches: query.includes('pointer: fine') ? fine : true, media: query }) as MediaQueryList,
  );
}

interface Mounted {
  fixture: ComponentFixture<CartPrinterIntro>;
  events: string[];
}

// Creates the overlay and records every output in order, before the first render
function create(): Mounted {
  const fixture = TestBed.createComponent(CartPrinterIntro);
  const events: string[] = [];
  const instance = fixture.componentInstance;
  instance.started.subscribe(() => events.push('started'));
  instance.reveal.subscribe(() => events.push('reveal'));
  instance.done.subscribe(() => events.push('done'));
  return { fixture, events };
}

// Renders, and waits for the lazy imports to reach scene creation; a card is placed unless the
// test already did, since without one the intro ends before it builds a scene
async function mountWithScene(): Promise<Mounted> {
  if (!document.querySelector('[data-intro-target]')) placeTarget({ width: 400, height: 500 });
  const mounted = create();
  mounted.fixture.detectChanges();
  await vi.waitFor(() => expect(factory).toHaveBeenCalled(), { timeout: 5000 });
  return mounted;
}

// Adds a stand-in for the receipt card; jsdom has no layout, so its rect is faked
function placeTarget(size: { width: number; height: number }): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-intro-target', '');
  el.getBoundingClientRect = () => ({ x: 10, y: 20, ...size }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

// Adds a stand-in for the torn edge under the card, with a faked rect
function placeEdge(rect: { x: number; y: number; width: number; height: number }): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-intro-edge', '');
  el.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(el);
  return el;
}

// The running timeline, which the host keeps private
function timelineOf(fixture: ComponentFixture<CartPrinterIntro>): GSAPTimeline {
  return (fixture.componentInstance as unknown as { timeline: GSAPTimeline }).timeline;
}

// A pointer press that bubbles to the overlay host, like a mouse, touch or pen would
function press(target: Element): void {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
}

// A key press that bubbles and can be cancelled
function key(target: Element, name: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

// Lets any pending import settle before asserting that nothing happened
const settleImports = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('CartPrinterIntro', () => {
  beforeEach(() => {
    scenes = [];
    // The WebGL answer is cached per session, so each test probes afresh
    resetWebglProbe();
    factory.mockReset();
    factory.mockImplementation(() => {
      const scene = fakeScene();
      scenes.push(scene);
      // The fake only has the members the host calls, so it is cast to the scene contract
      return scene as unknown as PrinterIntroScene;
    });
    texture.mockReset();
    texture.mockImplementation(() =>
      Promise.resolve({ canvas: document.createElement('canvas'), aspect: 2 }),
    );
    TestBed.configureTestingModule({
      imports: [CartPrinterIntro],
      providers: [{ provide: PRINTER_INTRO_DEPS, useValue: deps }],
    });
  });

  afterEach(() => {
    document
      .querySelectorAll('[data-intro-target], [data-intro-edge]')
      .forEach((el) => el.remove());
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'hidden');
    resetWebglProbe();
  });

  it('emits done at once and loads nothing when WebGL is unavailable', async () => {
    allowMotion();
    stubWebgl(false);
    const { fixture, events } = create();
    fixture.detectChanges();
    await settleImports();
    // No context: reveal then done, and no scene or texture was built
    expect(events).toEqual(['reveal', 'done']);
    expect(factory).not.toHaveBeenCalled();
    expect(texture).not.toHaveBeenCalled();
  });

  it('emits done at once under reduced motion', async () => {
    stubWebgl(true);
    const { fixture, events } = create();
    fixture.detectChanges();
    await settleImports();
    // The default matchMedia stub reports no motion preference
    expect(events).toEqual(['reveal', 'done']);
    expect(factory).not.toHaveBeenCalled();
  });

  it('renders an aria-hidden canvas layer and a real Skip button', () => {
    stubWebgl(false);
    const { fixture } = create();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // Decorative canvas stays out of the accessibility tree; the button is operable
    expect(el.querySelector('div[aria-hidden="true"] canvas')).not.toBeNull();
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('Skip intro');
  });

  it('starts and sizes the scene when the scene is built', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    const { events } = await mountWithScene();
    // Started fires once the scene exists
    expect(events).toEqual(['started']);
    expect(scenes[0].resize).toHaveBeenCalled();
  });

  it('draws the texture from the card and its torn edge, and gives the scene the canvas', async () => {
    allowMotion();
    stubWebgl(true);
    const card = placeTarget({ width: 400, height: 500 });
    const edge = placeEdge({ x: 10, y: 519, width: 400, height: 12 });
    const canvas = document.createElement('canvas');
    texture.mockImplementation(() => Promise.resolve({ canvas, aspect: 1.4 }));
    await mountWithScene();
    // The two elements are what the texture walks
    expect(texture.mock.calls[0][0]).toBe(card);
    expect(texture.mock.calls[0][1]).toBe(edge);
    expect(factory.mock.calls[0][3].receipt).toBe(canvas);
    expect(factory.mock.calls[0][3].paperAspect).toBe(1.4);
  });

  it('passes no edge to the texture when the torn edge is missing', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    await mountWithScene();
    expect(texture.mock.calls[0][1]).toBeNull();
  });

  it('shows the page without the intro when the target card is missing', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = create();
    fixture.detectChanges();
    await vi.waitFor(() => expect(events).toContain('done'), { timeout: 5000 });
    // No [data-intro-target] on the page: nothing to copy, so reveal then done
    expect(events).toEqual(['reveal', 'done']);
    expect(texture).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it.each([
    // The texture's real aspect reaches the scene; only absurd ones are capped to 0.25 .. 8
    { aspect: 1.25, clamped: 1.25 },
    { aspect: 4, clamped: 4 },
    { aspect: 6, clamped: 6 },
    { aspect: 20, clamped: 8 },
    { aspect: 0.1, clamped: 0.25 },
  ])('models the ticket at aspect $clamped for a texture of $aspect', async (row) => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    texture.mockImplementation(() =>
      Promise.resolve({ canvas: document.createElement('canvas'), aspect: row.aspect }),
    );
    await mountWithScene();
    expect(factory.mock.calls[0][3].paperAspect).toBe(row.clamped);
  });

  it('measures the card joined with its torn edge for the landing', async () => {
    allowMotion();
    stubWebgl(true);
    // Card 400 x 500 at (10, 20); the edge overlaps its last pixel and hangs 11 below it
    placeTarget({ width: 400, height: 500 });
    placeEdge({ x: 10, y: 519, width: 400, height: 12 });
    const { fixture } = await mountWithScene();

    // Union: card top 20 to edge bottom 531, so 511 tall
    const intro = fixture.componentInstance as unknown as { startLanding(): void };
    intro.startLanding();
    expect(scenes[0].setLanding).toHaveBeenLastCalledWith(
      { x: 10, y: 20, width: 400, height: 511 },
      expect.anything(),
    );
  });

  it('falls back to the card rect alone when the torn edge is missing', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    const { fixture } = await mountWithScene();

    const intro = fixture.componentInstance as unknown as { startLanding(): void };
    intro.startLanding();
    expect(scenes[0].setLanding).toHaveBeenLastCalledWith(
      { x: 10, y: 20, width: 400, height: 500 },
      expect.anything(),
    );
  });

  it('aims the landing at the card, or at nothing when it is gone', async () => {
    allowMotion();
    stubWebgl(true);
    const target = placeTarget({ width: 400, height: 500 });
    const { fixture } = await mountWithScene();
    const intro = fixture.componentInstance as unknown as { startLanding(): void };

    // The cue measures the card again and passes the viewport size (the canvas has none in jsdom)
    intro.startLanding();
    expect(scenes[0].setLanding).toHaveBeenLastCalledWith(
      expect.objectContaining({ x: 10, y: 20, width: 400, height: 500 }),
      { width: window.innerWidth, height: window.innerHeight },
    );

    // Card removed: the scene is told to fly past the camera instead
    target.remove();
    intro.startLanding();
    expect(scenes[0].setLanding).toHaveBeenLastCalledWith(null, expect.anything());
  });

  // The pointer listener exists only with a fine pointer, and the scene is fed from it
  it('listens to the pointer on fine pointers and feeds the eased value to the scene', async () => {
    allowMotionWithPointer(true);
    stubWebgl(true);
    const add = vi.spyOn(window, 'addEventListener');
    const { fixture } = await mountWithScene();
    const added = add.mock.calls.filter((c) => c[0] === 'pointermove');
    expect(added).toHaveLength(1);
    expect(added[0][2]).toEqual({ passive: true });

    // Pointer at the right edge, vertically centred
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        clientX: window.innerWidth,
        clientY: window.innerHeight / 2,
      }),
    );
    const intro = fixture.componentInstance as unknown as { paint(): void };
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    intro.paint();
    now.mockReturnValue(1016);
    intro.paint();
    // One 16 ms frame closes 8 percent of the gap, and the scene gets the eased value
    const [x, y] = scenes[0].setPointer.mock.lastCall as [number, number];
    expect(x).toBeCloseTo(0.08, 5);
    expect(y).toBeCloseTo(0, 5);

    // A longer frame closes more of the gap, and never overshoots
    now.mockReturnValue(1048);
    intro.paint();
    const [later] = scenes[0].setPointer.mock.lastCall as [number, number];
    expect(later).toBeGreaterThan(x);
    expect(later).toBeLessThan(1);
  });

  it('adds no pointer listener and never feeds the scene on touch devices', async () => {
    allowMotionWithPointer(false);
    stubWebgl(true);
    const add = vi.spyOn(window, 'addEventListener');
    const { fixture } = await mountWithScene();
    expect(add.mock.calls.some((c) => c[0] === 'pointermove')).toBe(false);

    (fixture.componentInstance as unknown as { paint(): void }).paint();
    expect(scenes[0].setPointer).not.toHaveBeenCalled();
  });

  it('removes the pointer listener when the intro finishes or the page is destroyed', async () => {
    allowMotionWithPointer(true);
    stubWebgl(true);
    const remove = vi.spyOn(window, 'removeEventListener');
    const first = await mountWithScene();
    // Skipping finishes the intro
    (first.fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(remove.mock.calls.filter((c) => c[0] === 'pointermove')).toHaveLength(1);

    // Destroying a second, still-playing intro removes its listener too
    scenes.length = 0;
    factory.mockClear();
    remove.mockClear();
    const second = await mountWithScene();
    second.fixture.destroy();
    expect(remove.mock.calls.filter((c) => c[0] === 'pointermove')).toHaveLength(1);
  });

  // A press on the overlay raises the speed 1.2 per press up to 6, ramped by a short tween
  it('raises the timeline speed stepwise to the cap on each press, with a ramp tween', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture } = await mountWithScene();
    const tl = timelineOf(fixture);
    // Paused so the test, not the clock, decides what the timeline does
    tl.pause();
    expect(tl.timeScale()).toBe(1);

    for (const target of [2.2, 3.4, 4.6, 5.8, 6, 6]) {
      press(fixture.nativeElement);
      // Only the newest ramp is alive, aimed at the new speed over about 0.15 s
      const tweens = gsap.getTweensOf(tl);
      expect(tweens).toHaveLength(1);
      expect(tweens[0].vars['timeScale']).toBeCloseTo(target, 5);
      expect(tweens[0].duration()).toBeCloseTo(0.15, 5);
    }
    // The ramp does not jump: the speed has not reached the cap yet
    expect(tl.timeScale()).toBeLessThan(6);
    await vi.waitFor(() => expect(tl.timeScale()).toBeCloseTo(6, 5), { timeout: 3000 });
  });

  it('ignores presses that land on the Skip button', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    const tl = timelineOf(fixture);
    tl.pause();
    press(fixture.nativeElement.querySelector('button'));
    // No ramp, and the intro keeps playing
    expect(gsap.getTweensOf(tl)).toHaveLength(0);
    expect(tl.timeScale()).toBe(1);
    expect(events).toEqual(['started']);
  });

  it('applies presses made before the timeline exists when it is built', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    // The texture waits, so the timeline cannot be built yet
    let release: (value: CardTexture) => void = () => undefined;
    texture.mockImplementation(() => new Promise<CardTexture>((resolve) => (release = resolve)));
    const { fixture, events } = create();
    fixture.detectChanges();
    await vi.waitFor(() => expect(texture).toHaveBeenCalled(), { timeout: 5000 });
    press(fixture.nativeElement);
    press(fixture.nativeElement);
    // Pressing while loading neither skips nor starts anything
    expect(events).toEqual([]);

    release({ canvas: document.createElement('canvas'), aspect: 2 });
    await vi.waitFor(() => expect(events).toEqual(['started']), { timeout: 5000 });
    const tl = timelineOf(fixture);
    tl.pause();
    // Two presses: 1 + 1.2 + 1.2, applied straight away
    expect(tl.timeScale()).toBeCloseTo(3.4, 5);
    expect(gsap.getTweensOf(tl)).toHaveLength(0);
  });

  it('counts Enter and Space on the overlay as presses and cancels their default', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture } = await mountWithScene();
    const tl = timelineOf(fixture);
    tl.pause();

    // Enter and Space are handled and prevented, each adding a step
    expect(key(fixture.nativeElement, 'Enter').defaultPrevented).toBe(true);
    expect(gsap.getTweensOf(tl)[0].vars['timeScale']).toBeCloseTo(2.2, 5);
    expect(key(fixture.nativeElement, ' ').defaultPrevented).toBe(true);
    expect(gsap.getTweensOf(tl)[0].vars['timeScale']).toBeCloseTo(3.4, 5);

    // A held key is not a stream of presses, but is still cancelled
    expect(key(fixture.nativeElement, 'Enter', true).defaultPrevented).toBe(true);
    expect(gsap.getTweensOf(tl)[0].vars['timeScale']).toBeCloseTo(3.4, 5);

    // Other keys are left alone
    expect(key(fixture.nativeElement, 'a').defaultPrevented).toBe(false);
  });

  it('leaves Enter and Space to the Skip button when it is the target', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    const tl = timelineOf(fixture);
    tl.pause();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    // Not handled by the overlay, so the button keeps its native behaviour
    expect(key(button, 'Enter').defaultPrevented).toBe(false);
    expect(key(button, ' ').defaultPrevented).toBe(false);
    expect(gsap.getTweensOf(tl)).toHaveLength(0);
    expect(events).toEqual(['started']);
  });

  it('no longer skips when the overlay is clicked', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    (fixture.nativeElement as HTMLElement).click();
    // A click is not a press; only Skip or Esc ends the intro early
    expect(events).toEqual(['started']);
  });

  it('shows a speed-up hint that fades out after the first press', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture } = await mountWithScene();
    fixture.detectChanges();
    const hint = (fixture.nativeElement as HTMLElement).querySelector('p') as HTMLElement;
    // Decorative, muted and never in the way of presses
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    expect(hint.textContent?.trim()).toBe('Tap to speed up');
    expect(hint.className).toContain('text-night-text/70');
    expect(hint.className).toContain('pointer-events-none');
    expect(hint.className).toContain('motion-reduce:transition-none');
    expect(hint.classList.contains('opacity-0')).toBe(false);

    press(fixture.nativeElement);
    fixture.detectChanges();
    expect(hint.classList.contains('opacity-0')).toBe(true);
  });

  it('emits reveal then done once when the sped-up timeline runs to its end', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    const tl = timelineOf(fixture);
    tl.pause();
    for (let i = 0; i < 6; i++) press(fixture.nativeElement);
    // Jump to the end as if the sped-up clock had run out
    tl.progress(1, false);
    expect(events).toEqual(['started', 'reveal', 'done']);
    // Later presses and a skip change nothing
    press(fixture.nativeElement);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(events).toEqual(['started', 'reveal', 'done']);
  });

  it('emits reveal then done once when the Skip button is clicked', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    button.click();
    // Skipping reveals first, then finishes, and a second click changes nothing
    expect(events).toEqual(['started', 'reveal', 'done']);
    expect(scenes[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('emits done when Escape is pressed', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    const { fixture, events } = create();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // Esc skips even before the scene is ready
    expect(events).toEqual(['reveal', 'done']);
    await settleImports();
    // The late import must not start anything afterwards
    expect(factory).not.toHaveBeenCalled();
    expect(events).toEqual(['reveal', 'done']);
  });

  it('skips when the tab becomes hidden', async () => {
    allowMotion();
    stubWebgl(true);
    const { events } = await mountWithScene();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    // A hidden tab would stall the timeline, so the intro ends
    expect(events).toEqual(['started', 'reveal', 'done']);
  });

  it('creates no scene when destroyed before the imports resolve', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture } = create();
    fixture.detectChanges();
    fixture.destroy();
    await settleImports();
    // The late import must not build a scene for a gone component
    expect(factory).not.toHaveBeenCalled();
    expect(texture).not.toHaveBeenCalled();
  });

  it('disposes the scene on destroy without emitting done', async () => {
    allowMotion();
    stubWebgl(true);
    const { fixture, events } = await mountWithScene();
    fixture.destroy();
    // GPU resources are released; the parent is already gone so nothing is emitted
    expect(scenes[0].dispose).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['started']);
  });

  it('emits done when the scene factory throws', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    factory.mockImplementation(() => {
      throw new Error('context creation failed');
    });
    const { fixture, events } = create();
    fixture.detectChanges();
    await vi.waitFor(() => expect(events).toContain('done'), { timeout: 5000 });
    // The page is revealed instead of waiting on a broken intro
    expect(events).toEqual(['reveal', 'done']);
  });

  it('emits done from the watchdog when the intro has not started in time', async () => {
    allowMotion();
    stubWebgl(true);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    placeTarget({ width: 400, height: 500 });
    // The texture never resolves, so the intro cannot start
    texture.mockImplementation(() => new Promise<CardTexture>(() => undefined));
    const { fixture, events } = create();
    fixture.detectChanges();
    // Not yet at 2.4 s, gone by 2.6 s
    await vi.advanceTimersByTimeAsync(2400);
    expect(events).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    // Watchdog fired: reveal then done
    expect(events).toEqual(['reveal', 'done']);
  });

  it('ignores Escape when another handler already used the key', async () => {
    allowMotion();
    stubWebgl(true);
    const { events } = await mountWithScene();
    // Another handler, earlier in the capture phase, claims the key
    const claim = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', claim, { capture: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    window.removeEventListener('keydown', claim, { capture: true });
    // The intro keeps playing
    expect(events).toEqual(['started']);
  });

  // A modal dialog over the page; focus starts on Skip even before three.js has loaded
  it('is a labelled modal dialog and focuses the Skip button before the scene loads', async () => {
    allowMotion();
    stubWebgl(true);
    placeTarget({ width: 400, height: 500 });
    // The texture never resolves, so the scene is not built
    texture.mockImplementation(() => new Promise<CardTexture>(() => undefined));
    const { fixture } = create();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.getAttribute('role')).toBe('dialog');
    expect(host.getAttribute('aria-modal')).toBe('true');
    expect(host.getAttribute('aria-label')).toBe('Cart intro');
    expect(document.activeElement).toBe(host.querySelector('button'));
    expect(factory).not.toHaveBeenCalled();
  });

  it('keeps the Skip button clear of notches', () => {
    stubWebgl(false);
    const { fixture } = create();
    fixture.detectChanges();
    const classes = (fixture.nativeElement.querySelector('button') as HTMLButtonElement).className;
    expect(classes).toContain('bottom-[max(1.5rem,env(safe-area-inset-bottom))]');
    expect(classes).toContain('right-[max(1.5rem,env(safe-area-inset-right))]');
  });
});

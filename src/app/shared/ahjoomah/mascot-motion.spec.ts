import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { Ahjoomah } from './ahjoomah';
import { animateMascot, bonk, squish, stopNudge } from './mascot-motion';

// Host with an open-eyed mascot and a stand-in Reserve button for the nudge
@Component({
  imports: [Ahjoomah],
  template: `
    <div data-testid="root"><app-ahjoomah mood="open" /></div>
    <button type="button" data-testid="target">Reserve</button>
  `,
})
class MascotHost {}

describe('mascot motion', () => {
  let root: HTMLElement;
  let target: HTMLElement;
  let now: number;

  // Drive GSAP by hand so timers can be stepped through deterministically
  const advance = (secs: number) => {
    for (let t = 0; t < secs; t += 0.05) gsap.updateRoot((now += 0.05));
  };

  beforeEach(async () => {
    gsap.ticker.remove(gsap.updateRoot);
    now = gsap.ticker.time;
    await TestBed.configureTestingModule({ imports: [MascotHost] }).compileComponents();
    const fixture = TestBed.createComponent(MascotHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    root = el.querySelector('[data-testid="root"]') as HTMLElement;
    target = el.querySelector('[data-testid="target"]') as HTMLElement;
  });

  afterEach(() => {
    gsap.ticker.add(gsap.updateRoot);
    vi.restoreAllMocks();
  });

  // Cleanup must detach the window pointer listener it added
  it('removes its pointermove listener on cleanup', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const cleanup = animateMascot(root);
    cleanup();
    expect(remove.mock.calls.some(([type]) => type === 'pointermove')).toBe(true);
  });

  // The target wiggles on schedule until the visitor hovers it, then never again
  it('stops nudging once the target is hovered', () => {
    const cleanup = animateMascot(root, { nudgeTarget: target, idle: false });
    let wiggled = false;
    for (let i = 0; i < 160 && !wiggled; i++) {
      advance(0.05);
      wiggled = gsap.getProperty(target, 'rotation') !== 0;
    }
    expect(wiggled).toBe(true);

    target.dispatchEvent(new Event('pointerenter'));
    advance(1);
    let moved = false;
    for (let i = 0; i < 400; i++) {
      advance(0.05);
      moved ||= gsap.getProperty(target, 'rotation') !== 0;
    }
    expect(moved).toBe(false);
    cleanup();
  });

  // Focus also ends the nudge and detaches the target listeners
  it('stops nudging on focus and unhooks the target', () => {
    const remove = vi.spyOn(target, 'removeEventListener');
    const cleanup = animateMascot(root, { nudgeTarget: target });
    target.dispatchEvent(new FocusEvent('focusin'));
    const types = remove.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointerenter', 'focusin', 'click']));
    cleanup();
  });

  // Hosts can stop the nudge directly (on a mascot tap) before it ever plays
  it('never nudges after stopNudge', () => {
    const cleanup = animateMascot(root, { nudgeTarget: target, idle: false });
    stopNudge(root);
    let moved = false;
    for (let i = 0; i < 400; i++) {
      advance(0.05);
      moved ||= gsap.getProperty(target, 'rotation') !== 0;
    }
    expect(moved).toBe(false);
    cleanup();
  });

  // Reactions need an svg to animate
  it('returns undefined from bonk and squish without an svg', () => {
    const empty = document.createElement('div');
    expect(bonk(empty)).toBeUndefined();
    expect(squish(empty)).toBeUndefined();
  });

  // A new reaction replaces the one in flight, and cleanup kills the survivor
  it('returns timelines that cancel each other and die on cleanup', () => {
    const cleanup = animateMascot(root);
    const first = bonk(root);
    const second = squish(root);
    expect(first).toBeInstanceOf(gsap.core.Timeline);
    expect(second).toBeInstanceOf(gsap.core.Timeline);
    expect(first?.isActive()).toBe(false);
    cleanup();
    advance(0.1);
    expect(second?.isActive()).toBe(false);
  });

  // Off-screen mascots freeze their loops and resume when visible again
  it('pauses while off-screen and disconnects its observer', () => {
    let notify: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(cb: typeof notify) {
        notify = cb;
      }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const cleanup = animateMascot(root);
    const head = root.querySelector('[data-part="head"]') as Element;
    const bob = gsap.getTweensOf(head)[0];
    notify([{ isIntersecting: false }]);
    expect(bob?.paused()).toBe(true);
    notify([{ isIntersecting: true }]);
    expect(bob?.paused()).toBe(false);
    cleanup();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InView } from './in-view';

@Component({
  imports: [InView],
  template: `<div appInView data-testid="block">Hello</div>`,
})
class Host {}

// Minimal IntersectionObserver that lets a test fire the callback by hand
class FakeObserver {
  static last?: FakeObserver;
  readonly options?: IntersectionObserverInit;
  constructor(
    private readonly callback: (entries: { isIntersecting: boolean }[]) => void,
    options?: IntersectionObserverInit,
  ) {
    this.options = options;
    FakeObserver.last = this;
  }
  observe(): void {}
  disconnect(): void {}
  fire(isIntersecting: boolean): void {
    this.callback([{ isIntersecting }]);
  }
}

// Stubs the browser APIs the directive checks, with the block below the fold
function stubBrowser(reducedMotion: boolean, top: number): void {
  vi.stubGlobal('matchMedia', () => ({ matches: !reducedMotion }));
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + 100,
  } as DOMRect);
}

describe('InView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('[data-testid="block"]') as HTMLElement;
  }

  // Without motion (SSR, jsdom, reduced motion) the block gets no state and stays visible
  it('leaves the block untouched when motion is not allowed', async () => {
    stubBrowser(true, 5000);
    const block = await render();
    expect(block.dataset['state']).toBeUndefined();
  });

  // Below the fold it is hidden first, then revealed once when it intersects
  it('arms a block below the fold and reveals it on intersection', async () => {
    stubBrowser(false, 5000);
    const block = await render();
    expect(block.dataset['state']).toBe('armed');
    FakeObserver.last?.fire(true);
    expect(block.dataset['state']).toBe('in');
  });

  // A bare appInView attribute must use the 0.2 default, not NaN (a NaN threshold throws and leaves it hidden)
  it('uses the default threshold when the attribute is empty', async () => {
    stubBrowser(false, 5000);
    await render();
    expect(FakeObserver.last?.options?.threshold).toBe(0.2);
  });

  // Scrolled past at load (reload mid-page): never hidden, so nothing above the fold stays blank
  it('shows a block that is already above the viewport at load', async () => {
    stubBrowser(false, -500);
    const block = await render();
    expect(block.dataset['state']).toBe('in');
  });

  // Jumping straight past the block never crosses the observer threshold; the scroll check reveals it
  it('reveals an armed block that a scroll jumps past', async () => {
    stubBrowser(false, 5000);
    const block = await render();
    expect(block.dataset['state']).toBe('armed');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: -500,
      bottom: -400,
    } as DOMRect);
    window.dispatchEvent(new Event('scroll'));
    expect(block.dataset['state']).toBe('in');
  });

  // Already on screen at load: no hide-then-replay flash
  it('shows a block that is already in view straight away', async () => {
    stubBrowser(false, 100);
    const block = await render();
    expect(block.dataset['state']).toBe('in');
  });
});

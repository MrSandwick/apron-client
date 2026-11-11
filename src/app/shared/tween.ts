import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Signal, effect, inject, signal, untracked } from '@angular/core';
import { motionAllowed } from './motion';

// Follows `source` with a short count to each new value. Starts on source() so SSR,
// hydration and tests are deterministic. Values are whole numbers (minor units) and the
// tween ends exactly on the target. Without motion (server, reduced motion) it jumps.
// Call in an injection context.
export function tweenedNumber(source: Signal<number>, ms = 400): Signal<number> {
  const platformId = inject(PLATFORM_ID);
  const value = signal(source());
  let frame = 0;

  // Stop any running tween
  const stop = () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  effect(() => {
    const target = source();
    stop(); // A new change cancels the running tween
    const from = untracked(value);

    // Jump straight to the target when motion is off or there is nothing to animate
    if (!isPlatformBrowser(platformId) || !motionAllowed() || from === target) {
      value.set(target);
      return;
    }

    const start = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - start) / ms, 1);
      const eased = 1 - Math.pow(1 - t, 3); // Ease-out cubic
      value.set(t >= 1 ? target : Math.round(from + (target - from) * eased));
      frame = t >= 1 ? 0 : requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  });

  inject(DestroyRef).onDestroy(stop);
  return value.asReadonly();
}

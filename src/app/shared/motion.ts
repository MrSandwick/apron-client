import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Query every motion build is gated on
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

// Shared entry point for scroll-driven motion. Registers ScrollTrigger and runs `build`
// only when the visitor allows motion (prefers-reduced-motion: no-preference), so
// reduced-motion users keep the static layout. Call from afterNextRender (browser only).
// Pass `alsoWhen` (a media query such as '(min-width: 768px)') to limit the build further,
// for example to skip a pinned scene on phones. Revert the returned MatchMedia in
// ngOnDestroy to kill every tween + trigger it made.
export function whenMotionAllowed(
  build: () => void | (() => void),
  alsoWhen?: string,
): gsap.MatchMedia {
  gsap.registerPlugin(ScrollTrigger); // idempotent
  const media = gsap.matchMedia();
  media.add(alsoWhen ? `${MOTION_OK} and ${alsoWhen}` : MOTION_OK, build);
  return media;
}

// Runs `frame` once now and again on scroll and resize, at most once per animation frame,
// through passive listeners. Browser only (call from afterNextRender). While `section` is
// well off screen (progress outside about -0.1 to 1.1) the scheduled frames do no work, so
// distant sections cost nothing per scroll event; the first frame back in range updates it.
// Returns a teardown that removes the listeners and cancels a pending frame.
export function onScrollFrame(section: Element, frame: () => void): () => void {
  let pending: number | undefined;
  const schedule = () => {
    if (pending !== undefined) return;
    pending = requestAnimationFrame(() => {
      pending = undefined;
      const progress = sectionProgress(section);
      if (progress < -0.1 || progress > 1.1) return;
      frame();
    });
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  frame();
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (pending !== undefined) cancelAnimationFrame(pending);
  };
}

// How far a section has travelled through the viewport: 0 as its top meets the bottom
// edge, 1 as its bottom meets the top edge (not clamped)
export function sectionProgress(el: Element): number {
  const rect = el.getBoundingClientRect();
  return (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
}

// Whether motion is allowed right now. For one-off checks outside a build, such as the 3D
// render loop deciding whether to spin or a tween deciding whether to count. False on the
// server, where matchMedia is missing, and when the visitor asks for reduced motion.
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOTION_OK).matches;
}

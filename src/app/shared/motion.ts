import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Query every motion build is gated on
const MOTION_OK = '(prefers-reduced-motion: no-preference)';

// Shared entry point for scroll-driven motion. Registers ScrollTrigger and runs `build`
// only when the visitor allows motion (prefers-reduced-motion: no-preference), so
// reduced-motion users keep the static layout. Call from afterNextRender (browser only).
// Pass `alsoWhen` (a media query such as '(min-width: 768px)') to limit the build further,
// for example to skip a pinned scene on phones. Revert the returned MatchMedia in
// ngOnDestroy to kill every tween + trigger it made.
export function whenMotionAllowed(build: () => void | (() => void), alsoWhen?: string): gsap.MatchMedia {
  gsap.registerPlugin(ScrollTrigger); // idempotent
  const media = gsap.matchMedia();
  media.add(alsoWhen ? `${MOTION_OK} and ${alsoWhen}` : MOTION_OK, build);
  return media;
}

// Whether motion is allowed right now (browser only). For one-off checks outside a build,
// such as the 3D render loop deciding whether to spin.
export function motionAllowed(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOTION_OK).matches;
}

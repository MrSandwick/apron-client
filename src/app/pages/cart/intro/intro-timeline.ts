import { IntroState, IntroTimelineCallbacks } from './intro-contract';
import { BEATS } from './intro-plan';

// Canvas opacity, tweened from 1 to 0 between fadeStart and fadeEnd. It is not part of
// IntroState (the scene never reads it); the host passes its own object and reads it in onFrame
export interface IntroFade {
  value: number;
}

type Gsap = typeof import('gsap').gsap;

const JERKS = 6;
const JERK_START = 0.6;
const JERK_STEP = 0.18; // seconds the paper moves
const JERK_GAP = 0.07; // pause before the next jerk, so one jerk lasts 0.25 s
const EXIT_SHARE = 0.7; // the printer is gone after this share of the landing

// Builds the intro as one GSAP timeline that starts playing at once. It tweens `state` (and
// `fade`), calls onFrame after every update, onReveal at BEATS.reveal and onDone at the end. Kill
// the returned timeline to stop it without further callbacks. Its timeScale may be raised to play
// faster; every beat moves together, so the order and the landing are unchanged.
export function buildIntroTimeline(
  gsap: Gsap,
  state: IntroState,
  callbacks: IntroTimelineCallbacks,
  fade: IntroFade = { value: 1 },
): GSAPTimeline {
  const beats = BEATS;
  const tl = gsap.timeline({
    paused: false,
    onUpdate: () => callbacks.onFrame(),
    onComplete: () => callbacks.onDone(),
  });

  addChoreography(tl, state, callbacks);

  // Page reveal starts once the ticket stands in place
  tl.call(() => callbacks.onReveal(), [], beats.reveal);
  // Canvas fades out; the ticket texture and sky match the real card, so the swap is invisible
  const fadeLength = beats.fadeEnd - beats.fadeStart;
  tl.to(fade, { value: 0, duration: fadeLength, ease: 'power1.in' }, beats.fadeStart);
  // Zero-length marker so the timeline lasts exactly `total`
  tl.set({}, {}, beats.total);
  return tl;
}

// Landing: the ticket glides to its spot and uncurls while the printer leaves
function addLanding(
  tl: GSAPTimeline,
  state: IntroState,
  callbacks: IntroTimelineCallbacks,
  from: number,
  to: number,
): void {
  // Measured here so the target is as current as it gets
  tl.call(() => callbacks.onLand?.(), [], from);
  tl.to(state, { fly: 1, duration: to - from, ease: 'power3.inOut' }, from);
  tl.to(state, { curl: 0, duration: to - from, ease: 'power1.out' }, from);
  tl.to(state, { exit: 1, duration: (to - from) * EXIT_SHARE, ease: 'power1.inOut' }, from);
}

function addChoreography(
  tl: GSAPTimeline,
  state: IntroState,
  callbacks: IntroTimelineCallbacks,
): void {
  const b = BEATS;

  // Printer pops in
  tl.to(state, { pop: 1, duration: b.pop, ease: 'back.out(2)' }, 0);

  // Light blinks twice while the printer warms up
  for (const at of [0.35, 0.475]) {
    tl.set(state, { ledOn: 1 }, at);
    tl.set(state, { ledOn: 0 }, at + 0.0625);
  }

  // Six feed jerks, each with a squash pulse, a quick wobble and a blink (4 Hz)
  for (let i = 0; i < JERKS; i++) {
    const at = JERK_START + i * (JERK_STEP + JERK_GAP);
    const sign = i % 2 === 0 ? 1 : -1;
    tl.to(state, { feed: (i + 1) / JERKS, duration: JERK_STEP, ease: 'power2.out' }, at);
    tl.to(state, { squash: 1, duration: 0.06, ease: 'power1.out' }, at);
    tl.to(state, { squash: 0, duration: 0.12, ease: 'power1.in' }, at + 0.06);
    tl.to(state, { jitter: sign, duration: 0.04, ease: 'none' }, at);
    tl.to(state, { jitter: -sign, duration: 0.05, ease: 'none' }, at + 0.04);
    tl.to(state, { jitter: 0, duration: 0.09, ease: 'power1.out' }, at + 0.09);
    tl.set(state, { ledOn: 1 }, at);
    tl.set(state, { ledOn: 0 }, at + 0.125);
  }

  // Cut: the ticket tears off and the light turns to done
  tl.set(state, { ledOn: 1 }, b.feed);
  tl.to(state, { cut: 1, duration: b.cut - b.feed, ease: 'power2.inOut' }, b.feed);
  tl.to(state, { ledDone: 1, duration: b.cut - b.feed, ease: 'none' }, b.feed);

  addLanding(tl, state, callbacks, b.cut, b.fly);
}

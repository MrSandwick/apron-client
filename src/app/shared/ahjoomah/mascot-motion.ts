import { gsap } from 'gsap';

export interface MascotMotionOptions {
  idle?: boolean; // idle routines on/off (default true)
  nudgeTarget?: HTMLElement; // enables the Reserve nudge
}

// How far (SVG units) her eyes may travel toward the cursor
const EYE_RANGE_X = 5;
const EYE_RANGE_Y = 3.5;
// Extra pupil offset for glances and nudges, on top of the cursor follow
const GLANCE = 3;
// Seconds between idle routines, and the nudge cadence
const IDLE_MIN = 6;
const IDLE_MAX = 10;
const NUDGE_FIRST = 4;
const NUDGE_EVERY = 8;
// How long a timer waits before retrying when another action is playing
const RETRY = 0.8;
// A cached rect older than this (ms) is re-measured on the next pointer frame
const RECT_TTL = 1000;

// Inline props the wiggle may leave on the target, cleared so its own CSS takes over again
const TARGET_PROPS = 'transform,translate,rotate,scale,transition';

const clamp = gsap.utils.clamp(-1, 1);

// Everything one mascot has running, so reactions can cancel each other and cleanup can
// kill whatever was created later from timers or host events
interface MascotState {
  root: HTMLElement;
  live: Set<gsap.core.Animation>;
  // The single action playing (blink, idle move, nudge, squish or bonk); undefined when free
  action?: gsap.core.Timeline;
  paused: boolean;
  // Nudge target, so an interrupted wiggle can be snapped back
  target?: HTMLElement;
  stopNudge: () => void;
}

const states = new WeakMap<HTMLElement, MascotState>();

function createState(root: HTMLElement): MascotState {
  const state: MascotState = { root, live: new Set(), paused: false, stopNudge: () => {} };
  states.set(root, state);
  return state;
}

// Reactions can fire before animateMascot (or after its cleanup); give them a bare state
function stateFor(root: HTMLElement): MascotState {
  return states.get(root) ?? createState(root);
}

// Registers an animation for pause/resume/cleanup and drops ones that already finished
function track<T extends gsap.core.Animation>(state: MascotState, anim: T): T {
  for (const a of state.live) if (a.totalProgress() >= 1) state.live.delete(a);
  state.live.add(anim);
  if (state.paused) anim.pause();
  return anim;
}

function untrack(state: MascotState, anim: gsap.core.Animation | undefined): void {
  if (!anim) return;
  anim.kill();
  state.live.delete(anim);
}

function part(root: HTMLElement, name: string): SVGGElement | null {
  return root.querySelector<SVGGElement>(`[data-part="${name}"]`);
}

// Pupils are re-created whenever the mood flips, so they are looked up per action
function pupils(root: HTMLElement): SVGGElement | null {
  return part(root, 'pupils');
}

// Starts `build` as the one running action, cancelling whatever was playing
function runAction(
  state: MascotState,
  build: (tl: gsap.core.Timeline) => void,
): gsap.core.Timeline {
  if (state.action) {
    untrack(state, state.action);
    if (state.target) gsap.set(state.target, { clearProps: TARGET_PROPS });
  }
  const tl = gsap.timeline({
    onComplete: () => {
      if (state.action === tl) state.action = undefined;
    },
  });
  settle(state.root, tl);
  build(tl);
  state.action = tl;
  return track(state, tl);
}

// Eases any part an interrupted action left mid-move back to rest
function settle(root: HTMLElement, tl: gsap.core.Timeline): void {
  const svg = root.querySelector('svg');
  const hands = part(root, 'hands');
  const eyes = part(root, 'eyes');
  const pup = pupils(root);
  if (svg) tl.to(svg, { yPercent: 0, rotation: 0, duration: 0.1 }, 0);
  if (hands) tl.to(hands, { y: 0, rotation: 0, duration: 0.1 }, 0);
  if (eyes) tl.to(eyes, { scaleY: 1, duration: 0.07 }, 0);
  if (pup) tl.to(pup, { x: 0, y: 0, duration: 0.1 }, 0);
}

// Two quick dips of the pin, optionally tilted toward one side
function pinTap(root: HTMLElement, tl: gsap.core.Timeline, tilt = 0): void {
  const hands = part(root, 'hands');
  if (!hands) return;
  tl.to(hands, {
    y: 2.5,
    rotation: tilt,
    transformOrigin: '50% 50%',
    duration: 0.08,
    ease: 'power2.in',
    yoyo: true,
    repeat: 3,
  });
}

// Eyes slide left, pause, slide right, then return to centre
function glance(pup: SVGGElement, tl: gsap.core.Timeline): void {
  tl.to(pup, { x: -GLANCE, duration: 0.25, ease: 'power2.inOut' })
    .to(pup, { x: GLANCE, duration: 0.4, ease: 'power2.inOut' }, '+=0.5')
    .to(pup, { x: 0, duration: 0.25, ease: 'power2.inOut' }, '+=0.5');
}

// Idle life for a rendered <app-ahjoomah>: gentle bob, random blinks, cursor eye-follow,
// occasional idle moves and an optional nudge toward a target. Only one action plays at a
// time. Call it inside a whenMotionAllowed build and return its cleanup from that build.
export function animateMascot(root: HTMLElement, options: MascotMotionOptions = {}): () => void {
  const { idle = true, nudgeTarget } = options;
  // A previous run on the same root is replaced, not stacked
  states.get(root)?.live.forEach((a) => a.kill());
  const state = createState(root);
  state.target = nudgeTarget;

  const head = part(root, 'head');
  const lower = [part(root, 'body'), part(root, 'arms')].filter(
    (p): p is SVGGElement => p !== null,
  );
  const eyes = part(root, 'eyes');

  // Bob: the head leads and the body follows a beat later, so she reads as alive, not sliding
  const bob = { y: -4, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 };
  if (head) track(state, gsap.to(head, bob));
  if (lower.length) track(state, gsap.to(lower, { ...bob, y: -2, delay: 0.2 }));

  // Each timer reschedules itself; if another action is playing it retries shortly after
  const timer = (delay: () => number, fire: () => boolean) => {
    let call: gsap.core.Tween | undefined;
    const schedule = (secs: number) => {
      untrack(state, call);
      call = track(
        state,
        gsap.delayedCall(secs, () => schedule(!state.action && fire() ? delay() : RETRY)),
      );
    };
    return { schedule, stop: () => untrack(state, call) };
  };

  // Blink at random intervals; skipped while she shows the closed happy eyes
  const blink = timer(
    () => gsap.utils.random(2.4, 5),
    () => {
      if (eyes && pupils(root)) {
        runAction(state, (tl) =>
          tl.to(eyes, {
            scaleY: 0.1,
            transformOrigin: '50% 50%',
            duration: 0.07,
            yoyo: true,
            repeat: 1,
          }),
        );
      }
      return true;
    },
  );
  blink.schedule(gsap.utils.random(2.4, 5));

  // Idle moves: a pin tap, or a glance when her eyes are open
  const idleMoves = timer(
    () => gsap.utils.random(IDLE_MIN, IDLE_MAX),
    () => {
      const pup = pupils(root);
      runAction(state, (tl) => (pup && Math.random() < 0.5 ? glance(pup, tl) : pinTap(root, tl)));
      return true;
    },
  );
  if (idle) idleMoves.schedule(gsap.utils.random(IDLE_MIN, IDLE_MAX));

  // Cursor follow, throttled to one measurement per frame and skipped while off-screen
  const toX = eyes ? gsap.quickTo(eyes, 'x', { duration: 0.45, ease: 'power3' }) : undefined;
  const toY = eyes ? gsap.quickTo(eyes, 'y', { duration: 0.45, ease: 'power3' }) : undefined;
  if (toX) track(state, toX.tween);
  if (toY) track(state, toY.tween);
  let rect: DOMRect | undefined;
  let measuredAt = 0;
  const freshRect = () => {
    const now = performance.now();
    if (!rect || now - measuredAt > RECT_TTL) {
      rect = root.getBoundingClientRect();
      measuredAt = now;
    }
    return rect;
  };
  const invalidate = () => (rect = undefined);
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const follow = () => {
    frame = 0;
    const r = freshRect();
    const dx = (pointerX - (r.left + r.width / 2)) / (window.innerWidth / 2);
    const dy = (pointerY - (r.top + r.height * 0.4)) / (window.innerHeight / 2);
    toX?.(clamp(dx) * EYE_RANGE_X);
    toY?.(clamp(dy) * EYE_RANGE_Y);
  };
  const onMove = (e: PointerEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!frame && !state.paused) frame = requestAnimationFrame(follow);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', invalidate, { passive: true, capture: true });
  window.addEventListener('resize', invalidate, { passive: true });

  // Nudge toward the target: look at it, tap the pin toward it, and give it a wiggle
  const nudgeEvents = ['pointerenter', 'focusin', 'click'] as const;
  const nudge = timer(
    () => NUDGE_EVERY,
    () => {
      if (!nudgeTarget) return true;
      const from = freshRect();
      const to = nudgeTarget.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height * 0.4);
      const len = Math.hypot(dx, dy) || 1;
      const pup = pupils(root);
      runAction(state, (tl) => {
        if (pup) {
          tl.to(pup, { x: (dx / len) * GLANCE, y: (dy / len) * GLANCE, duration: 0.25 });
        }
        pinTap(root, tl, dx < 0 ? -4 : 4);
        // Switch off the target's CSS transition (btn-primary eases transform) so it doesn't lag each frame
        tl.set(nudgeTarget, { transition: 'none' }, '<');
        tl.to(
          nudgeTarget,
          {
            keyframes: { rotation: [0, -3, 3, -2, 0] },
            duration: 0.5,
            ease: 'sine.inOut',
            clearProps: TARGET_PROPS,
          },
          '<',
        );
        if (pup) tl.to(pup, { x: 0, y: 0, duration: 0.3 }, '+=0.4');
      });
      return true;
    },
  );
  const endNudge = () => {
    nudge.stop();
    nudgeEvents.forEach((type) => nudgeTarget?.removeEventListener(type, endNudge));
  };
  state.stopNudge = endNudge;
  if (nudgeTarget) {
    nudgeEvents.forEach((type) => nudgeTarget.addEventListener(type, endNudge));
    nudge.schedule(NUDGE_FIRST);
  }

  // Freeze every timer and loop while she is off-screen or the tab is hidden
  let onScreen = true;
  const syncPaused = () => {
    const pause = !onScreen || document.hidden;
    if (pause === state.paused) return;
    state.paused = pause;
    state.live.forEach((a) => (pause ? a.pause() : a.resume()));
    if (pause && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    invalidate();
  };
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? true;
          syncPaused();
        });
  observer?.observe(root);
  document.addEventListener('visibilitychange', syncPaused);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', invalidate, { capture: true });
    window.removeEventListener('resize', invalidate);
    document.removeEventListener('visibilitychange', syncPaused);
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    endNudge();
    state.live.forEach((a) => a.kill());
    state.live.clear();
    state.action = undefined;
    if (states.get(root) === state) states.delete(root);
    const parts = [root.querySelector('svg'), head, eyes, pupils(root), part(root, 'hands')];
    const moved = [...parts, ...lower].filter((p) => p !== null);
    if (moved.length) gsap.set(moved, { clearProps: 'transform' });
    if (nudgeTarget) gsap.set(nudgeTarget, { clearProps: TARGET_PROPS });
  };
}

// Stops the Reserve nudge for good; hosts call it on the first tap on the mascot
export function stopNudge(root: HTMLElement): void {
  states.get(root)?.stopNudge();
}

// Happy squish: squashes down then springs back up, anchored at her feet. Only call it
// while motion is allowed; it cancels any action or reaction already playing.
export function squish(root: HTMLElement): gsap.core.Timeline | undefined {
  const svg = root.querySelector('svg');
  if (!svg) return undefined;
  return runAction(stateFor(root), (tl) =>
    tl
      .to(svg, { scaleX: 1.08, scaleY: 0.9, transformOrigin: '50% 100%', duration: 0.12 }, 0)
      .to(svg, { scaleX: 0.96, scaleY: 1.06, duration: 0.14, ease: 'power2.out' })
      .to(svg, { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }),
  );
}

// Tap reaction: she bonks the pin and hops, landing with a small squash. The host decides
// the mood; this only animates and cancels anything already playing.
export function bonk(root: HTMLElement): gsap.core.Timeline | undefined {
  const svg = root.querySelector('svg');
  if (!svg) return undefined;
  const hands = part(root, 'hands');
  return runAction(stateFor(root), (tl) => {
    // Pin bonk: a hard dip with a little tilt, then a springy recovery
    if (hands) {
      tl.to(hands, { y: 4, rotation: -8, transformOrigin: '50% 50%', duration: 0.08 }, 0).to(
        hands,
        { y: 0, rotation: 0, duration: 0.35, ease: 'back.out(3)' },
      );
    }
    // Hop of about 16 SVG units (of 260 tall), then land with a squash
    tl.to(
      svg,
      {
        yPercent: -6.2,
        scaleX: 0.97,
        scaleY: 1.04,
        transformOrigin: '50% 100%',
        duration: 0.22,
        ease: 'power2.out',
      },
      0.06,
    )
      .to(svg, { yPercent: 0, scaleX: 1, scaleY: 1, duration: 0.18, ease: 'power2.in' })
      .to(svg, { scaleX: 1.08, scaleY: 0.92, duration: 0.07, ease: 'power2.out' })
      .to(svg, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' });
  });
}

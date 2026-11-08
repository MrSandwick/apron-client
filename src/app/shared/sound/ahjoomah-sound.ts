import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  Signal,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Short synthesized cues the page can trigger
export type SoundCue = 'pop' | 'bonk' | 'ding' | 'whoosh';

const STORAGE_KEY = 'ahjoomah-sound';
// Grill sizzle level and its fade time in seconds
const AMBIENCE_GAIN = 0.035;
const AMBIENCE_FADE = 0.4;
// Floor for exponential ramps, which cannot reach zero
const SILENT = 0.0001;

// Constructor lookup that also covers older Safari's prefixed AudioContext
type AudioContextCtor = new () => AudioContext;
interface AudioWindow {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
}

// Live nodes of the looping sizzle so it can be faded out and torn down
interface Ambience {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

// Optional sound layer, off until the visitor opts in. Every sound is synthesized with
// Web Audio, and the AudioContext is only ever created inside a user gesture.
@Injectable({ providedIn: 'root' })
export class AhjoomahSound {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly enabledState = signal(false);
  readonly enabled: Signal<boolean> = this.enabledState.asReadonly();

  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private sizzle: AudioBuffer | null = null;
  private ambienceNodes: Ambience | null = null;
  // What the host last asked for, so turning sound on can start the sizzle
  private ambienceWanted = false;
  private disarmGesture: (() => void) | null = null;

  constructor() {
    // Restore after first render so prerendered HTML and hydration agree
    afterNextRender(() => {
      if (readSaved() !== true) return;
      this.enabledState.set(true);
      this.armGesture();
    });

    inject(DestroyRef).onDestroy(() => {
      this.disarmGesture?.();
      this.stopAmbience(true);
      this.ctx?.close().catch(() => undefined);
      this.ctx = null;
    });
  }

  toggle(): void {
    const next = !this.enabledState();
    this.enabledState.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // Storage blocked (private mode etc.); the choice just won't persist
    }

    // This click is the gesture, so the pending first-gesture listener is no longer needed
    this.disarmGesture?.();
    if (next) {
      if (this.ensureContext() && this.ambienceWanted) this.startAmbience();
    } else {
      this.stopAmbience();
    }
  }

  play(cue: SoundCue): void {
    // Silent until enabled and a gesture has produced a context
    const ctx = this.enabledState() ? this.ctx : null;
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      switch (cue) {
        case 'pop':
          this.pop(ctx, t);
          break;
        case 'bonk':
          this.bonk(ctx, t);
          break;
        case 'ding':
          this.ding(ctx, t);
          break;
        case 'whoosh':
          this.whoosh(ctx, t);
          break;
      }
    } catch {
      // A failed cue should never break the page
    }
  }

  ambience(on: boolean): void {
    this.ambienceWanted = on;
    if (on && this.enabledState() && this.ctx) this.startAmbience();
    if (!on) this.stopAmbience();
  }

  // Saved 'on': wait for the visitor's first pointer or key press before making sound
  private armGesture(): void {
    if (!this.isBrowser || this.disarmGesture) return;
    const onGesture = () => {
      this.disarmGesture?.();
      if (this.enabledState() && this.ensureContext() && this.ambienceWanted) {
        this.startAmbience();
      }
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    this.disarmGesture = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      this.disarmGesture = null;
    };
  }

  // Creates or resumes the context; must be called from within a user gesture
  private ensureContext(): AudioContext | null {
    if (!this.isBrowser) return null;
    if (!this.ctx) {
      const w = window as unknown as AudioWindow;
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  // Quick upward sine blip
  private pop(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(1040, t + 0.08);
    const gain = envelope(ctx, t, 0.14, 0.008, 0.12);
    osc.connect(gain);
    playFor(osc, t, 0.14, gain);
  }

  // Wooden tok: falling triangle plus a tiny filtered noise click
  private bonk(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.15);
    const gain = envelope(ctx, t, 0.16, 0.004, 0.18);
    osc.connect(gain);
    playFor(osc, t, 0.2, gain);

    const click = ctx.createBufferSource();
    click.buffer = this.noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2000, t);
    const clickGain = envelope(ctx, t, 0.05, 0.002, 0.03);
    click.connect(hp);
    hp.connect(clickGain);
    playFor(click, t, 0.04, hp, clickGain);
  }

  // Soft bell from two sine partials with a long exponential tail
  private ding(ctx: AudioContext, t: number): void {
    for (const [freq, level] of [
      [880, 0.12],
      [1320, 0.05],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const gain = envelope(ctx, t, level, 0.006, 0.6);
      osc.connect(gain);
      playFor(osc, t, 0.65, gain);
    }
  }

  // Airy swish: bandpassed noise whose centre sweeps up and back down
  private whoosh(ctx: AudioContext, t: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.2, t);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.15);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);
    gain.connect(ctx.destination);
    src.connect(bp);
    bp.connect(gain);
    playFor(src, t, 0.36, bp, gain);
  }

  private startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || this.ambienceNodes) return;
    try {
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = this.sizzleBuffer(ctx);
      source.loop = true;
      // Keep only the hiss band of a grill
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4500, t);
      filter.Q.setValueAtTime(0.7, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(AMBIENCE_GAIN, t + AMBIENCE_FADE);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(t);
      this.ambienceNodes = { source, filter, gain };
    } catch {
      this.ambienceNodes = null;
    }
  }

  // Fades the sizzle out, then stops and disconnects it; immediate on teardown
  private stopAmbience(immediate = false): void {
    const nodes = this.ambienceNodes;
    const ctx = this.ctx;
    this.ambienceNodes = null;
    if (!nodes || !ctx) return;
    const disconnect = () => {
      nodes.source.disconnect();
      nodes.filter.disconnect();
      nodes.gain.disconnect();
    };
    try {
      const t = ctx.currentTime;
      const fade = immediate ? 0 : AMBIENCE_FADE;
      nodes.gain.gain.cancelScheduledValues(t);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, t);
      nodes.gain.gain.linearRampToValueAtTime(0, t + fade);
      nodes.source.onended = disconnect;
      nodes.source.stop(t + fade + 0.02);
    } catch {
      disconnect();
    }
  }

  // One second of white noise, shared by the noise-based cues
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  // Three seconds of soft hiss with random fat-crackle spikes baked in
  private sizzleBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.sizzle) {
      const length = Math.floor(ctx.sampleRate * 3);
      this.sizzle = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.sizzle.getChannelData(0);
      let crackle = 0;
      for (let i = 0; i < data.length; i++) {
        // Roughly forty pops a second, each a fast-decaying burst
        if (Math.random() < 40 / ctx.sampleRate) crackle = 0.6 + Math.random() * 0.4;
        crackle *= 0.995;
        const n = Math.random() * 2 - 1;
        data[i] = n * (0.35 + crackle);
      }
    }
    return this.sizzle;
  }
}

// Gain node with a fast linear attack and an exponential decay, wired to the output
function envelope(
  ctx: AudioContext,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, t + decay);
  gain.connect(ctx.destination);
  return gain;
}

// Starts a one-shot source and disconnects it and its chain once it has finished
function playFor(
  node: AudioScheduledSourceNode,
  t: number,
  duration: number,
  ...chain: AudioNode[]
): void {
  node.onended = () => {
    node.disconnect();
    for (const n of chain) n.disconnect();
  };
  node.start(t);
  node.stop(t + duration);
}

function readSaved(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === 'on';
  } catch {
    return null;
  }
}

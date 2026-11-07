import { Injectable, afterNextRender, signal } from '@angular/core';

// Experimental voice layer. Ahjoomah's lines stay hidden unless this is true, so the
// site always looks complete without them.
export const VOICE_ENABLED = false;
// Shows the "Let Ahjoomah talk" toggle so visitors can opt in themselves
export const VOICE_TOGGLE = true;

// One line: optional Korean phrase with its small translation, then her English line
export interface VoiceLine {
  kr?: string;
  gloss?: string;
  text: string;
}

// Every line she says, keyed by the section she says it in
export const VOICE_LINES = {
  hero: { kr: '밥 먹었어?', gloss: 'Did you eat yet?', text: 'No? Sit, sit. I feed you.' },
  promo: { kr: '빨리 빨리!', gloss: 'Hurry, hurry!', text: 'Unlimited meat waits for nobody.' },
  steps: { kr: '아이고', gloss: 'aigoo: oh my', text: "Don't burn the galbi. I'm watching." },
  about: { text: "Same recipes since 2019. My recipes. Don't ask for them." },
  reserve: {
    kr: '빨리 빨리',
    gloss: 'quick, quick',
    text: 'Tables go fast. Book now, thank me later.',
  },
  menu: { kr: '아이고', gloss: 'aigoo', text: 'Everything is good. But you get the galbi.' },
} satisfies Record<string, VoiceLine>;

export type VoiceSection = keyof typeof VOICE_LINES;

const STORAGE_KEY = 'ahjoomah-voice';

// Whether her lines are showing. Starts at VOICE_ENABLED and then honours the visitor's
// saved choice, read after first render so prerendered HTML and hydration always agree.
@Injectable({ providedIn: 'root' })
export class AhjoomahVoice {
  readonly enabled = signal(VOICE_ENABLED);

  constructor() {
    afterNextRender(() => {
      const saved = readSaved();
      if (saved !== null) this.enabled.set(saved);
    });
  }

  toggle(): void {
    const next = !this.enabled();
    this.enabled.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // Storage blocked (private mode etc.); the choice just won't persist
    }
  }
}

function readSaved(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === 'on';
  } catch {
    return null;
  }
}

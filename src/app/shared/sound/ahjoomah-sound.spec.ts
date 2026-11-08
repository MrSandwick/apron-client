import { TestBed } from '@angular/core/testing';
import { AhjoomahSound } from './ahjoomah-sound';
import { SoundToggle } from './sound-toggle';

// Minimal Web Audio stand-in, since jsdom has none; it records every node it makes
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  type = '';
  loop = false;
  buffer: unknown = null;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
  connect() {
    return this;
  }
  disconnect() {}
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

const created: FakeNode[] = [];

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'suspended';
  readonly destination = {};
  private make() {
    const node = new FakeNode();
    created.push(node);
    return node;
  }
  createOscillator() {
    return this.make();
  }
  createGain() {
    return this.make();
  }
  createBiquadFilter() {
    return this.make();
  }
  createBufferSource() {
    return this.make();
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

type AudioGlobal = { AudioContext?: unknown };

describe('AhjoomahSound', () => {
  let sound: AhjoomahSound;

  beforeEach(() => {
    created.length = 0;
    localStorage.clear();
    (globalThis as AudioGlobal).AudioContext = FakeAudioContext;
    sound = TestBed.inject(AhjoomahSound);
  });

  afterEach(() => {
    delete (globalThis as AudioGlobal).AudioContext;
    localStorage.clear();
  });

  // Opt-in only: a fresh visitor hears nothing
  it('is disabled by default and play() makes no nodes', () => {
    sound.play('pop');
    expect(sound.enabled()).toBe(false);
    expect(created.length).toBe(0);
  });

  // Turning it on saves the choice and lets cues build audio graphs
  it('toggle() enables, persists on, and play() creates nodes', () => {
    sound.toggle();
    expect(sound.enabled()).toBe(true);
    expect(localStorage.getItem('ahjoomah-sound')).toBe('on');

    sound.play('bonk');
    expect(created.length).toBeGreaterThan(0);
  });

  // Ambience waits for opt-in, starts once enabled, and stops on request
  it('only sounds the sizzle while enabled', () => {
    sound.ambience(true);
    expect(created.length).toBe(0);

    sound.toggle();
    const loop = created.find((n) => n.loop);
    expect(loop?.started).toBe(true);

    sound.ambience(false);
    expect(loop?.stopped).toBe(true);
  });

  // Browsers without Web Audio just stay silent
  it('does not throw when AudioContext is missing', () => {
    delete (globalThis as AudioGlobal).AudioContext;
    expect(() => {
      sound.toggle();
      sound.play('ding');
      sound.ambience(true);
      sound.play('whoosh');
      sound.ambience(false);
    }).not.toThrow();
    expect(sound.enabled()).toBe(true);
  });
});

describe('SoundToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as AudioGlobal).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    delete (globalThis as AudioGlobal).AudioContext;
    localStorage.clear();
  });

  // Clicking flips the pressed state and the accessible label together
  it('flips aria-pressed and its label', async () => {
    await TestBed.configureTestingModule({ imports: [SoundToggle] }).compileComponents();
    const fixture = TestBed.createComponent(SoundToggle);
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="sound-toggle"]',
    );
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Sound off');

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Sound on');
  });
});

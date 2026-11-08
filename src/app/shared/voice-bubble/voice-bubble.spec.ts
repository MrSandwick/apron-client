import { TestBed } from '@angular/core/testing';
import { VoiceBubble } from './voice-bubble';
import { VoiceToggle } from './voice-toggle';
import { AhjoomahVoice, VOICE_ENABLED, VOICE_LINES } from '../ahjoomah-voice';

describe('Ahjoomah voice layer', () => {
  beforeEach(async () => {
    // The toggle persists the choice, so start every test from a clean slate
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [VoiceBubble, VoiceToggle],
    }).compileComponents();
  });

  // The flag ships off, so the default site carries no speech bubbles
  it('is off by default and renders no bubble', async () => {
    expect(VOICE_ENABLED).toBe(false);
    const fixture = TestBed.createComponent(VoiceBubble);
    fixture.componentRef.setInput('section', 'hero');
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="voice-bubble"]'),
    ).toBeNull();
  });

  // Once enabled, the bubble shows the section's Korean phrase, gloss and line
  it('renders the section line when the voice is on', async () => {
    TestBed.inject(AhjoomahVoice).enabled.set(true);
    const fixture = TestBed.createComponent(VoiceBubble);
    fixture.componentRef.setInput('section', 'hero');
    await fixture.whenStable();
    const bubble = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="voice-bubble"]',
    );
    expect(bubble?.textContent).toContain(VOICE_LINES.hero.kr);
    expect(bubble?.textContent).toContain(VOICE_LINES.hero.gloss);
    expect(bubble?.textContent).toContain(VOICE_LINES.hero.text);
  });

  // The visitor toggle flips the shared state and reports it via aria-pressed
  it('lets the visitor switch the voice on', async () => {
    const fixture = TestBed.createComponent(VoiceToggle);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="voice-toggle"]',
    );
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    button?.click();
    await fixture.whenStable();
    expect(TestBed.inject(AhjoomahVoice).enabled()).toBe(true);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });
});

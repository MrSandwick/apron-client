import { Component, computed, inject, input } from '@angular/core';
import { AhjoomahVoice, VOICE_LINES, VoiceLine, VoiceSection } from '../ahjoomah-voice';

// Speech bubble with Ahjoomah's line for one section. Renders nothing while the voice
// layer is off, so hosts can place it freely without affecting the default layout.
@Component({
  selector: 'app-voice-bubble',
  templateUrl: './voice-bubble.html',
})
export class VoiceBubble {
  readonly section = input.required<VoiceSection>();
  // Colour world of the surrounding section
  readonly tone = input<'night' | 'kitchen'>('night');

  protected readonly voice = inject(AhjoomahVoice);
  protected readonly line = computed<VoiceLine>(() => VOICE_LINES[this.section()]);
}

import { Component, inject } from '@angular/core';
import { AhjoomahVoice, VOICE_TOGGLE } from '../ahjoomah-voice';

// Visitor opt-in for Ahjoomah's speech bubbles. Hidden entirely when VOICE_TOGGLE is off.
@Component({
  selector: 'app-voice-toggle',
  template: `
    @if (visible) {
      <button
        type="button"
        [attr.aria-pressed]="voice.enabled()"
        (click)="voice.toggle()"
        class="inline-flex items-center gap-2 rounded-full border border-brand-amber/20 px-4 py-2 font-sans text-[13px] font-bold text-brand-muted transition-colors hover:border-brand-amber/45 hover:text-brand-cream aria-pressed:border-brand-amber/60 aria-pressed:bg-brand-amber/10 aria-pressed:text-brand-amber"
        data-testid="voice-toggle"
      >
        <!-- Speech bubble icon (stands in for the plan's emoji) -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
          class="size-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.625 9.75h6.75M8.625 13.5h3.75M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
        Let Ahjoomah talk
      </button>
    }
  `,
})
export class VoiceToggle {
  protected readonly voice = inject(AhjoomahVoice);
  protected readonly visible = VOICE_TOGGLE;
}

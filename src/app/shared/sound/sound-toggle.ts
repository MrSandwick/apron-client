import { Component, computed, inject } from '@angular/core';
import { AhjoomahSound } from './ahjoomah-sound';

// Round opt-in button for the synthesized sound layer, styled for the light dawn sky
@Component({
  selector: 'app-sound-toggle',
  template: `
    <button
      type="button"
      [attr.aria-pressed]="sound.enabled()"
      [attr.aria-label]="label()"
      (click)="onClick()"
      class="inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-white/55 text-day-ink ring-1 ring-day-ink/15 backdrop-blur transition-colors hover:bg-white/75 aria-pressed:bg-day-ink aria-pressed:text-brand-cream aria-pressed:hover:bg-day-ink-soft"
      data-testid="sound-toggle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="size-5"
      >
        <!-- Speaker body, shared by both states -->
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        @if (sound.enabled()) {
          <!-- Sound waves when on -->
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        } @else {
          <!-- Slash across the speaker when off -->
          <path d="M4 4l16 16" />
        }
      </svg>
    </button>
  `,
})
export class SoundToggle {
  protected readonly sound = inject(AhjoomahSound);
  protected readonly label = computed(() => (this.sound.enabled() ? 'Sound on' : 'Sound off'));

  // Flip the setting, then confirm with a little pop when it just turned on
  protected onClick(): void {
    this.sound.toggle();
    if (this.sound.enabled()) this.sound.play('pop');
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Poses of the face mascot: dozing, happy hop, or a wink with a waving hand
export type AhjoomahFaceMood = 'sleepy' | 'delighted' | 'waving';

// Whole-svg motion per mood. Full class names are kept as literals so Tailwind can see them.
// The motion-safe: variant means reduced motion keeps only the static pose.
const MOTION: Record<AhjoomahFaceMood, string> = {
  sleepy: 'motion-safe:animate-mascot-doze',
  delighted: 'motion-safe:animate-mascot-hop',
  waving: '',
};

// Animatable inline-SVG port of public/images/ahjoomah-face.svg (that file is used through <img>,
// so its parts cannot move). Size and display are set by the parent; the svg fills the host.
// Purely decorative: nearby text already says everything, so the host is hidden from assistive tech.
@Component({
  selector: 'app-ahjoomah-face',
  templateUrl: './ahjoomah-face.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-mood]': 'mood()',
  },
})
export class AhjoomahFace {
  readonly mood = input<AhjoomahFaceMood>('delighted');

  readonly motionClass = computed(() => MOTION[this.mood()]);
}

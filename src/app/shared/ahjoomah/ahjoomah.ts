import { Component, booleanAttribute, computed, input } from '@angular/core';

// Eye style: closed happy arcs (matches the logo) or open dots that can track the cursor
export type AhjoomahMood = 'happy' | 'open';

// Chibi Ahjoomah: big head, red apron, rolling pin. Pure inline SVG so it prerenders and
// so motion code can target its parts through data-part hooks (head, eyes, pupils, arms, hands,
// pin, body). The component itself is static; animation is layered on by its host.
@Component({
  selector: 'app-ahjoomah',
  templateUrl: './ahjoomah.html',
  host: { class: 'block' },
})
export class Ahjoomah {
  readonly mood = input<AhjoomahMood>('happy');
  // Decorative copies (next to visible brand text) are hidden from assistive tech
  readonly decorative = input(false, { transform: booleanAttribute });
  readonly label = input('Ahjoomah in her red apron, holding a rolling pin');

  readonly ariaLabel = computed(() => (this.decorative() ? null : this.label()));
}

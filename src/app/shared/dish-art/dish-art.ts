import { Component, input } from '@angular/core';

// Illustrated dishes available as placeholders
export type DishKind =
  | 'grill'
  | 'meat'
  | 'stew'
  | 'rice'
  | 'noodles'
  | 'banchan'
  | 'drink'
  | 'dessert';

// Image slot for a dish: shows a flat illustration in Ahjoomah's style by default and a
// real photo once `src` is set. The 4:3 frame is fixed, so swapping in photos later
// causes no layout shift. Illustrations are decorative unless `alt` is given.
@Component({
  selector: 'app-dish-art',
  templateUrl: './dish-art.html',
  host: { class: 'block' },
})
export class DishArt {
  readonly kind = input.required<DishKind>();
  readonly src = input<string>();
  readonly alt = input('');
  // Frame background to suit the surrounding colour world
  readonly tone = input<'night' | 'kitchen'>('night');
}

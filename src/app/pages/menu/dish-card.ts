import { Component, computed, input } from '@angular/core';
import { DishArt } from '../../shared/dish-art/dish-art';
import { DISH_TAG_LABELS, DISH_TAG_ORDER, DishTag, MenuDish } from './menu.data';

// One menu dish: image slot, name, Korean name, description, tag badges and price, with an
// "Ahjoomah's pick" sticker on picked dishes and a NEW marker on new ones. Fills its grid
// cell so cards in a row match.

// Badge colours. Each pairs text and fill for at least 4.5:1 contrast, and every badge also
// carries a text label, so colour is never the only signal
const TAG_STYLES: Record<DishTag, string> = {
  spicy: 'bg-brand-apron-deep text-brand-cream',
  mild: 'bg-brand-amber text-day-ink',
  vegetarian: 'bg-tag-leaf text-brand-cream',
};
@Component({
  selector: 'app-dish-card',
  imports: [DishArt],
  templateUrl: './dish-card.html',
  host: { class: 'block h-full' },
})
export class DishCard {
  readonly dish = input.required<MenuDish>();

  // The dish's tags in the fixed display order, with their label and colours
  protected readonly tags = computed(() => {
    const own = this.dish().tags ?? [];
    return DISH_TAG_ORDER.filter((tag) => own.includes(tag)).map((tag) => ({
      tag,
      label: DISH_TAG_LABELS[tag],
      styles: TAG_STYLES[tag],
    }));
  });
}

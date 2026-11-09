import { Component, computed, input, output } from '@angular/core';
import { DISH_TAG_LABELS, DISH_TAG_ORDER, MenuDish } from './menu.data';

// One row in a priced list section (drinks, off menu): name, Korean name, a short description and
// the price, with a small add button. The whole row is the button's tap area, like the food cards
@Component({
  selector: 'app-list-row',
  templateUrl: './list-row.html',
  host: { class: 'block' },
})
export class ListRow {
  readonly dish = input.required<MenuDish>();
  // Emitted when a guest chooses to order this item; the page opens the item dialog for it
  readonly select = output<MenuDish>();

  // Items with choices open the dialog to customize; plain ones read as a quick add
  protected readonly hasOptions = computed(() => !!this.dish().optionGroups?.length);
  protected readonly actionLabel = computed(
    () => `${this.hasOptions() ? 'Customize' : 'Add'} ${this.dish().name}`,
  );

  // Tags as plain words in the fixed order, shown as one quiet line
  protected readonly tagText = computed(() => {
    const own = this.dish().tags ?? [];
    return DISH_TAG_ORDER.filter((t) => own.includes(t))
      .map((t) => DISH_TAG_LABELS[t])
      .join(' · ');
  });
}

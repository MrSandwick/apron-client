import { Component, input } from '@angular/core';
import { DishArt } from '../../shared/dish-art/dish-art';
import { MenuDish } from './menu.data';

// One menu dish: image slot, name, optional Korean name, description and price, with an
// "Ahjoomah's pick" sticker on picked dishes. Fills its grid cell so cards in a row match.
@Component({
  selector: 'app-dish-card',
  imports: [DishArt],
  templateUrl: './dish-card.html',
  host: { class: 'block h-full' },
})
export class DishCard {
  readonly dish = input.required<MenuDish>();
}

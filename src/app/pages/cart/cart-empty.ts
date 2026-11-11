import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AhjoomahFace } from '../../shared/ahjoomah/ahjoomah-face';

// Shown in place of the cart when nothing has been added yet
@Component({
  selector: 'app-cart-empty',
  imports: [AhjoomahFace, RouterLink],
  templateUrl: './cart-empty.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CartEmpty {}

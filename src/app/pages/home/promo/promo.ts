import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Home promo: the limited-time "Unlimited KBBQ Night" offer card.
@Component({
  selector: 'app-home-promo',
  imports: [RouterLink],
  templateUrl: './promo.html',
})
export class HomePromo {}

import { Component } from '@angular/core';
import { HomeHero } from './hero/hero';
import { HomePromo } from './promo/promo';
import { HomeAbout } from './about/about';
import { HomeReserve } from './reserve/reserve';

// Home page: composes the section components in top-to-bottom order.
@Component({
  selector: 'app-home',
  imports: [HomeHero, HomePromo, HomeAbout, HomeReserve],
  templateUrl: './home.html',
})
export class Home {}

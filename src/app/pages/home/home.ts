import { Component } from '@angular/core';
import { HomeHero } from './hero/hero';
import { HomePromo } from './promo/promo';
import { HomeAbout } from './about/about';

@Component({
  selector: 'app-home',
  imports: [HomeHero, HomePromo, HomeAbout],
  templateUrl: './home.html',
})
export class Home {}

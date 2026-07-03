import { Component } from '@angular/core';
import { HomeHero } from './hero/hero';
import { HomePromo } from './promo/promo';

@Component({
  selector: 'app-home',
  imports: [HomeHero, HomePromo],
  templateUrl: './home.html',
})
export class Home {}

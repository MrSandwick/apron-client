import { Component } from '@angular/core';
import { HomeHero } from './hero/hero';
import { HomePromo } from './promo/promo';
import { HomeAbout } from './about/about';
import { HomeReserve } from './reserve/reserve';
import { HomeStatement } from './statement/statement';
import { HomeSteps } from './steps/steps';
import { HomeVisit } from './visit/visit';

// Home page: composes the section components in top-to-bottom (morning-to-night) order.
@Component({
  selector: 'app-home',
  imports: [HomeHero, HomeStatement, HomeAbout, HomePromo, HomeSteps, HomeVisit, HomeReserve],
  templateUrl: './home.html',
})
export class Home {}

import { Component } from '@angular/core';
import { HomeHero } from './hero/hero';

@Component({
  selector: 'app-home',
  imports: [HomeHero],
  templateUrl: './home.html',
})
export class Home {}

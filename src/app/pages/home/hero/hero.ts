import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThreeCanvas } from '../../../three/three-canvas/three-canvas';

// Home hero: headline, Korean subtitle, and the primary reserve/menu CTAs.
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, ThreeCanvas],
  templateUrl: './hero.html',
})
export class HomeHero {}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionCanvas } from '../../../three/section-canvas/section-canvas';

// Home hero: headline, Korean subtitle, and the primary reserve/menu CTAs.
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink, SectionCanvas],
  templateUrl: './hero.html',
})
export class HomeHero {}

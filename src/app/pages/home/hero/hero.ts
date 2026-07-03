import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Home hero: headline, Korean subtitle, and the primary reserve/menu CTAs.
@Component({
  selector: 'app-home-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
})
export class HomeHero {}

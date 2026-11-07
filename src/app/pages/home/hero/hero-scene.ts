import { Component } from '@angular/core';

// Decorative dawn scene for the hero: sun, clouds, mountains, the Namsan skyline, hanok
// rooftops and a string of lanterns. Pure markup; HomeHero animates it (intro, parallax,
// idle loops) through the data-layer / data-intro / data-cloud / data-smoke / data-swing hooks.
@Component({
  selector: 'app-hero-scene',
  templateUrl: './hero-scene.html',
  host: { class: 'contents' },
})
export class HeroScene {
  // Lantern knots on the string (SVG units), computed from its curve so each one sits on it
  readonly lanterns = [
    { x: 120, y: 19 },
    { x: 240, y: 48 },
    { x: 360, y: 52 },
    { x: 480, y: 31 },
  ];
}

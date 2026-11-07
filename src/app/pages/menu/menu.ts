import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../shared/reveal';
import { AhjoomahPeek } from '../../shared/ahjoomah/ahjoomah-peek';
import { VoiceBubble } from '../../shared/voice-bubble/voice-bubble';
import { DishCard } from './dish-card';
import { MENU } from './menu.data';

// Menu page in the dusk palette: a golden-hour header with a setting sun, a sticky
// category nav, then one section of dish cards per category as the sky darkens.
@Component({
  selector: 'app-menu',
  imports: [RouterLink, Reveal, AhjoomahPeek, VoiceBubble, DishCard],
  templateUrl: './menu.html',
})
export class Menu {
  protected readonly categories = MENU;
}

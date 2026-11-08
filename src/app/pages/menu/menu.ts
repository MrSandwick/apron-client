import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../shared/reveal';
import { AhjoomahPeek } from '../../shared/ahjoomah/ahjoomah-peek';
import { VoiceBubble } from '../../shared/voice-bubble/voice-bubble';
import { DishCard } from './dish-card';
import { MenuService } from './menu.service';

// Menu page in the dusk palette: a golden-hour header with a setting sun, a sticky
// category nav, then one section of dish cards per category as the sky darkens.
@Component({
  selector: 'app-menu',
  imports: [RouterLink, Reveal, AhjoomahPeek, VoiceBubble, DishCard],
  templateUrl: './menu.html',
})
export class Menu {
  // Undefined while the menu is still loading
  protected readonly result = toSignal(inject(MenuService).load());
  protected readonly categories = computed(() => this.result()?.categories ?? []);
  // Placeholder blocks shown in the loading skeleton
  protected readonly skeleton = [0, 1, 2];
}

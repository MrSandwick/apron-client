import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../../shared/reveal';
import { AhjoomahPeek } from '../../../shared/ahjoomah/ahjoomah-peek';
import { VoiceBubble } from '../../../shared/voice-bubble/voice-bubble';

// Home promo: the limited-time "Unlimited KBBQ Night" offer card.
@Component({
  selector: 'app-home-promo',
  imports: [RouterLink, Reveal, AhjoomahPeek, VoiceBubble],
  templateUrl: './promo.html',
})
export class HomePromo {}

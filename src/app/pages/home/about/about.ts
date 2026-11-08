import { Component } from '@angular/core';
import { Reveal } from '../../../shared/reveal';
import { VoiceBubble } from '../../../shared/voice-bubble/voice-bubble';

// Home about, in the early-afternoon light: "Our Story" copy beside the engraved wood
// logo. Find Us and Hours live in HomeVisit, later in the evening part of the page.
@Component({
  selector: 'app-home-about',
  imports: [Reveal, VoiceBubble],
  templateUrl: './about.html',
})
export class HomeAbout {}

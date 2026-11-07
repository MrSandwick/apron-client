import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionCanvas } from '../../../three/section-canvas/section-canvas';
import { Reveal } from '../../../shared/reveal';
import { VoiceBubble } from '../../../shared/voice-bubble/voice-bubble';

// Home reserve: booking pitch, feature list, and the reserve CTA, beside a 3D green bottle.
@Component({
  selector: 'app-home-reserve',
  imports: [RouterLink, SectionCanvas, Reveal, VoiceBubble],
  templateUrl: './reserve.html',
})
export class HomeReserve {
  // Bullet points shown beside the booking copy.
  readonly features = [
    'Available 7 days a week',
    'Instant confirmation by email',
    'Groups of 2 – 30 guests',
    'Special occasions & private dining',
  ];
}

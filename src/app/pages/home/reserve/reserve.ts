import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Home reserve: booking pitch, feature list, and the reserve CTA.
@Component({
  selector: 'app-home-reserve',
  imports: [RouterLink],
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

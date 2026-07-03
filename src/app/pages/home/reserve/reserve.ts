import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-reserve',
  imports: [RouterLink],
  templateUrl: './reserve.html',
})
export class HomeReserve {
  readonly features = [
    'Available 7 days a week',
    'Instant confirmation by email',
    'Groups of 2 – 30 guests',
    'Special occasions & private dining',
  ];
}

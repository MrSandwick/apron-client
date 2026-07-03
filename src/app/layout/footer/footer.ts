import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// App footer shell: brand, quick links, contact, and newsletter signup.
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class Footer {
  // Site-section links shown under "Quick Links".
  readonly quickLinks = [
    { label: 'Home', link: '/home' },
    { label: 'Menu', link: '/menu' },
    { label: 'Reservations', link: '/reserve' },
    { label: 'Order Online', link: '/order' },
  ];

  // Placeholder until the newsletter backend is wired.
  onSubmit(event: Event): void {
    event.preventDefault();
  }
}

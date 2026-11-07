import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoiceToggle } from '../../shared/voice-bubble/voice-toggle';

// App footer shell: brand, quick links, contact, and newsletter signup.
@Component({
  selector: 'app-footer',
  imports: [RouterLink, VoiceToggle],
  templateUrl: './footer.html',
})
export class Footer {
  // Copyright year, kept current automatically.
  readonly year = new Date().getFullYear();

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

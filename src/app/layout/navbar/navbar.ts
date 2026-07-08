import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

// App navigation shell: brand, page links, and reservation/cart actions.
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
})
export class Navbar {
  // Mobile menu disclosure; collapsed by default, revealed by the hamburger.
  readonly menuOpen = signal(false);

  toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}

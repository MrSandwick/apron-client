import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../core/cart/cart.service';

// App navigation shell: brand, page links, and reservation/cart actions.
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
})
export class Navbar {
  // Mobile menu disclosure; collapsed by default, revealed by the hamburger.
  readonly menuOpen = signal(false);

  // Items in the cart; 0 on the server and until the browser reads storage, so HTML matches
  protected readonly count = inject(CartService).count;

  // Accessible name of the cart link, with the item count when there is one
  protected readonly cartLabel = computed(() => {
    const n = this.count();
    return n > 0 ? `Cart, ${n} ${n === 1 ? 'item' : 'items'}` : 'Cart';
  });

  toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
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

  private readonly cart = inject(CartService);

  // Items in the cart; 0 on the server and until the browser reads storage, so HTML matches
  protected readonly count = this.cart.count;

  // Re-keys the badge on each increase so the pop animation replays
  protected readonly popKey = signal(0);

  // True after an increase, false after a decrease; drives the pop class
  protected readonly popActive = signal(false);

  // Count seen on the last run; null until the stored cart has been read
  private previous: number | null = null;

  // Accessible name of the cart link, with the item count when there is one
  protected readonly cartLabel = computed(() => {
    const n = this.count();
    return n > 0 ? `Cart, ${n} ${n === 1 ? 'item' : 'items'}` : 'Cart';
  });

  constructor() {
    // Pop the badge when the count goes up, never for the cart loaded from storage
    effect(() => {
      if (!this.cart.ready()) {
        return;
      }
      const n = this.count();
      const before = this.previous;
      this.previous = n;
      // First run after ready only records the loaded count
      if (before === null || n === before) {
        return;
      }
      untracked(() => {
        if (n > before) {
          this.popKey.update((k) => k + 1);
          this.popActive.set(true);
        } else {
          this.popActive.set(false);
        }
      });
    });
  }

  toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}

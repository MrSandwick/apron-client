import { Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NewCartLine } from '../../core/cart/cart.model';
import { CartService } from '../../core/cart/cart.service';
import { Reveal } from '../../shared/reveal';
import { AhjoomahPeek } from '../../shared/ahjoomah/ahjoomah-peek';
import { VoiceBubble } from '../../shared/voice-bubble/voice-bubble';
import { DishCard } from './dish-card';
import { ItemDialog } from './item-dialog/item-dialog';
import { MenuDish } from './menu.data';
import { formatPrice } from './menu.mapper';
import { MenuService } from './menu.service';

// How long the "Added to cart" confirmation stays up
const TOAST_MS = 4000;

// Menu page in the dusk palette: a golden-hour header with a setting sun, a sticky
// category nav, then one section of dish cards per category as the sky darkens.
@Component({
  selector: 'app-menu',
  imports: [RouterLink, Reveal, AhjoomahPeek, VoiceBubble, DishCard, ItemDialog],
  templateUrl: './menu.html',
})
export class Menu {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  protected readonly cart = inject(CartService);

  // Undefined while the menu is still loading
  protected readonly result = toSignal(inject(MenuService).load());
  protected readonly categories = computed(() => this.result()?.categories ?? []);
  // Placeholder blocks shown in the loading skeleton
  protected readonly skeleton = [0, 1, 2];

  // The dish id in the address (?item=), which makes every item a shareable link
  private readonly itemId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('item'))),
    { initialValue: null },
  );
  // Flips after first render in the browser, so server and hydrated HTML match
  private readonly hydrated = signal(false);
  // The dish whose dialog is open: the address drives it; unknown and sold-out ids open nothing
  protected readonly activeDish = computed<MenuDish | null>(() => {
    const id = this.itemId();
    if (!id || !this.hydrated()) {
      return null;
    }
    const dish = this.categories()
      .flatMap((c) => c.dishes)
      .find((d) => d.id === id);
    return dish && !dish.soldOut ? dish : null;
  });

  // True when the dialog was opened from a card on this page, so closing can step back in history
  // instead of leaving an extra entry; a deep link has no earlier page entry to go back to
  private openedInPage = false;

  // Confirmation after adding, cleared by a timer; empty text means no toast
  protected readonly toastText = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly cartTotalText = computed(() =>
    formatPrice(this.cart.totalMinor(), this.cart.currency()),
  );

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
    // The address lost its item (Back button, manual edit): nothing is open in-page any more
    effect(() => {
      if (!this.itemId()) {
        this.openedInPage = false;
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.toastTimer));
  }

  protected open(dish: MenuDish): void {
    if (dish.soldOut) {
      return;
    }
    this.openedInPage = true;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: dish.id },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  protected close(): void {
    if (this.openedInPage) {
      // One step back undoes the entry the open pushed
      this.openedInPage = false;
      this.location.back();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
      replaceUrl: true,
    });
  }

  protected add(line: NewCartLine): void {
    const added = this.cart.add(line);
    if (added) {
      this.close();
    }
    this.toastText.set(added ? 'Added to cart' : 'Your cart is in another currency');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastText.set(''), TOAST_MS);
  }
}

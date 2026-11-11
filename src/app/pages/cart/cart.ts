import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { CartLine } from '../../core/cart/cart.model';
import { CartService } from '../../core/cart/cart.service';
import { AhjoomahFace, AhjoomahFaceMood } from '../../shared/ahjoomah/ahjoomah-face';
import { motionAllowed } from '../../shared/motion';
import { TweenedAmount } from '../../shared/tweened-amount';
import { BackdropMood } from './backdrop/backdrop-scene';
import { CartBackdrop } from './backdrop/cart-backdrop';
import { CartEmpty } from './cart-empty';
import { CartLineItem } from './cart-line';
import { CartSummary } from './cart-summary';
import { DeliveryPanel } from './delivery-panel';
import { FulfillmentMode, FulfillmentToggle } from './fulfillment-toggle';
import { CartPrinterIntro } from './intro/printer-intro';
import { webglAvailable } from './intro/webgl';
import { PromoField } from './promo-field';

// Lines past this index share the last stamp-in delay, so a long cart does not drag on
const STAGGER_LINES = 8;
// After the intro the dynamic content stamps in this many ms apart: lines, summary values, mascot
const INTRO_STEP_MS = 90;
// Margin after the mascot's delay for its 450ms hop to finish before the stamp classes go
const STAMP_TAIL_MS = 560;
// If the overlay has not started this long after the page asked for it (its chunk failed to
// load, say), the page is shown without the intro
const INTRO_SAFETY_MS = 3000;

type IntroPhase = 'off' | 'pending' | 'playing' | 'revealing' | 'done';

// Cart page: the guest's lines with steppers, a takeout / delivery choice and the order summary.
// The saved cart is only readable in the browser, so everything that depends on it waits for
// cart.ready() and the server HTML is the same for every guest.
@Component({
  selector: 'app-cart-page',
  imports: [
    AhjoomahFace,
    CartBackdrop,
    CartEmpty,
    CartLineItem,
    CartPrinterIntro,
    CartSummary,
    DeliveryPanel,
    FulfillmentToggle,
    PromoField,
    TweenedAmount,
  ],
  templateUrl: './cart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  protected readonly cart = inject(CartService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly root = this.doc.documentElement;

  // Not saved: the page always opens on takeout
  protected readonly mode = signal<FulfillmentMode>('takeout');
  protected readonly isDelivery = computed(() => this.mode() === 'delivery');

  // Text for the polite live region
  protected readonly announcement = signal('');

  // The heading takes focus when the last line is removed
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  // Mascot pose: waving when the guest picks delivery, otherwise delighted
  protected readonly faceMood = computed<AhjoomahFaceMood>(() =>
    this.isDelivery() ? 'waving' : 'delighted',
  );

  // Backdrop mood follows the mascot: cool blue on delivery, warm otherwise
  protected readonly backdropMood = computed<BackdropMood>(() =>
    this.isDelivery() ? 'cool' : 'warm',
  );

  // Printer intro: off until the guest is eligible, then pending -> playing -> revealing -> done
  protected readonly introPhase = signal<IntroPhase>('off');

  // True once the intro was queued, so a finished or skipped intro is told apart from none
  private readonly introQueued = signal(false);

  // The receipt is laid out (the 3D ticket is drawn from it) but inert, and its dynamic parts are
  // hidden, until the 3D ticket has landed on it
  protected readonly contentHidden = computed(
    () => this.introPhase() === 'pending' || this.introPhase() === 'playing',
  );

  // Until the overlay is up the receipt is see-through, so nothing flashes before it; the 3D
  // ticket reads the card's layout, never its opacity
  protected readonly receiptPending = computed(() => this.introPhase() === 'pending');

  // The ambient backdrop only shows when there is no intro or it is over
  protected readonly backdropReady = computed(
    () => this.introPhase() === 'off' || this.introPhase() === 'done',
  );

  // The heading is hidden only while the printer scene plays
  protected readonly headerHidden = computed(() => this.introPhase() === 'playing');

  protected readonly introRan = computed(
    () => (this.introPhase() === 'revealing' || this.introPhase() === 'done') && this.introQueued(),
  );

  // Enter animations are skipped when the intro ran or is running; the intro is the entrance then
  protected enterFx(cls: string): string {
    return this.introRan() || this.contentHidden() ? '' : cls;
  }

  // True from reveal while the card content stamps in
  protected readonly introStamp = signal(false);
  private stampTimer?: ReturnType<typeof setTimeout>;

  // True once the stamp has reached the summary, so the subtotal counts up from 0 then
  private readonly summaryIn = signal(false);
  private summaryTimer?: ReturnType<typeof setTimeout>;

  // Subtotal for the summary and the sticky bar: held at 0 while the intro hides it, so the
  // tween counts up to the real total when the summary stamps in
  protected readonly subtotalMinor = computed(() =>
    this.introDriven() && !this.summaryIn() ? 0 : this.cart.totalMinor(),
  );

  // Class for the dynamic parts of the card: invisible until the reveal, then stamping in
  protected readonly stampClass = computed(() => {
    if (this.contentHidden()) return 'opacity-0';
    return this.introStamp() ? 'motion-safe:animate-stamp-in' : '';
  });

  // Page-level guard against an overlay that never starts; cleared by any sign of life from it
  private introTimer?: ReturnType<typeof setTimeout>;

  private clearIntroTimer(): void {
    clearTimeout(this.introTimer);
    this.introTimer = undefined;
  }

  protected onIntroStarted(): void {
    this.clearIntroTimer();
    this.introPhase.set('playing');
  }

  protected onIntroReveal(): void {
    this.clearIntroTimer();
    this.focusHeadingFromOverlay();
    this.introPhase.set('revealing');
    this.startStamp();
  }

  // The overlay is about to go: focus on its Skip button moves to the page heading, not to the body
  private focusHeadingFromOverlay(): void {
    const overlay = this.host.nativeElement.querySelector('app-cart-printer-intro');
    if (overlay?.contains(this.doc.activeElement)) {
      this.heading()?.nativeElement.focus({ preventScroll: true });
    }
  }

  // The overlay never started: reveal the page at once and drop the overlay
  private onIntroTimeout(): void {
    this.introTimer = undefined;
    if (this.introPhase() !== 'pending') return;
    this.onIntroReveal();
    this.onIntroDone();
  }

  // The static card is already on screen at reveal; its dynamic parts then stamp in, and the stamp
  // classes are dropped once the last (the mascot's hop) has finished so they cannot fight later
  // animations. The subtotal starts counting when the summary's stamp begins
  private startStamp(): void {
    this.introStamp.set(true);
    clearTimeout(this.stampTimer);
    this.stampTimer = setTimeout(
      () => this.introStamp.set(false),
      this.introMascotDelay() + STAMP_TAIL_MS,
    );
    clearTimeout(this.summaryTimer);
    this.summaryTimer = setTimeout(() => this.summaryIn.set(true), this.summaryDelay());
  }

  protected onIntroDone(): void {
    this.clearIntroTimer();
    this.introPhase.set('done');
  }

  // Changing this key re-creates the mascot so its one-shot hop plays again
  protected readonly hopKey = signal(0);

  protected readonly countText = computed(() => {
    const count = this.cart.count();
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  });

  // Animation delay (ms) for a line's stamp-in, capped. After the intro the card is already in
  // place, so lines stamp in one after another at once; otherwise they wait for the receipt to print
  protected lineDelay(index: number): number {
    const step = Math.min(index, STAGGER_LINES);
    return this.introDriven() ? INTRO_STEP_MS * (step + 1) : 450 + step * 70;
  }

  // The summary values and the header count stamp in once the last staggered line has landed
  protected readonly summaryDelay = computed(() => {
    const count = Math.min(this.cart.lines().length, STAGGER_LINES + 1);
    return this.introDriven() ? INTRO_STEP_MS * (count + 1) : 450 + count * 70;
  });

  // The mascot stamps in last, and its hop is delayed to match
  protected readonly introMascotDelay = computed(
    () => INTRO_STEP_MS * (Math.min(this.cart.lines().length, STAGGER_LINES + 1) + 2),
  );

  // The printer intro is, or was, the entrance for this visit
  private readonly introDriven = computed(() => this.contentHidden() || this.introRan());

  protected changeQuantity(line: CartLine, quantity: number): void {
    // A line that is already gone (animating out) ignores late clicks
    if (!this.cart.lines().some((l) => l.key === line.key)) {
      return;
    }
    this.cart.setQuantity(line.key, quantity);
    this.announcement.set(`${line.name}, quantity ${quantity}`);
    // Only a higher quantity makes the mascot hop
    if (quantity > line.quantity) {
      this.hopKey.update((k) => k + 1);
    }
  }

  protected removeLine(line: CartLine): void {
    const lines = this.cart.lines();
    const index = lines.findIndex((l) => l.key === line.key);
    // Already removed (a second click while it animates out): nothing to do
    if (index === -1) {
      return;
    }
    // Focus goes to the line that takes this one's place, else the one before it
    const neighbour = lines[index + 1] ?? lines[index - 1];
    this.cart.remove(line.key);
    this.announcement.set(`${line.name} removed`);
    // Wait for the list to update before moving focus
    afterNextRender(
      () => {
        const button = neighbour ? this.removeButtonFor(neighbour.key) : null;
        (button ?? this.heading()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  // Keys contain quotes, so match on the attribute value instead of building a selector.
  // Only keys still in the cart are asked for, so a line that is animating out is never picked
  private removeButtonFor(key: string): HTMLElement | null {
    const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-remove]');
    return Array.from(buttons).find((b) => b.getAttribute('data-remove') === key) ?? null;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.stampTimer);
      clearTimeout(this.summaryTimer);
      this.clearIntroTimer();
      if (this.isBrowser) this.releasePage();
    });

    // The printer intro is the default entrance whenever it can run: browser only, motion allowed
    // and WebGL available (an empty cart is skipped below once the saved cart is read). Nothing
    // that differs from the server's HTML renders before cart.ready(), so hydration still matches
    if (this.isBrowser && motionAllowed() && webglAvailable()) {
      this.introQueued.set(true);
      this.introPhase.set('pending');
      this.introTimer = setTimeout(() => this.onIntroTimeout(), INTRO_SAFETY_MS);
    }

    // An empty cart has no ticket to print, so the intro is skipped or, if the cart was emptied
    // while it ran (another tab), ended at once so no hidden or inert state is left behind
    effect(() => {
      const phase = this.introPhase();
      if (!this.cart.ready() || this.cart.lines().length > 0) return;
      if (phase === 'pending' || phase === 'playing' || phase === 'revealing') {
        this.clearIntroTimer();
        this.focusHeadingFromOverlay();
        this.introPhase.set('done');
        // Nothing will stamp in, so a later subtotal shows at once
        this.summaryIn.set(true);
      }
    });

    // While the intro plays the navbar waits off screen (data-intro), the page cannot scroll and
    // starts at the top, so the card is in view and its landing spot cannot go stale
    effect(() => {
      if (!this.isBrowser) return;
      const playing = this.contentHidden() && this.cart.ready() && this.cart.lines().length > 0;
      if (!playing) {
        this.releasePage();
        return;
      }
      this.root.dataset['intro'] = 'playing';
      if (!this.root.classList.contains('overflow-hidden')) {
        this.root.classList.add('overflow-hidden');
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    });
  }

  // Gives the page back: navbar slides in, scrolling works again
  private releasePage(): void {
    delete this.root.dataset['intro'];
    this.root.classList.remove('overflow-hidden');
  }
}

import { Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NewCartLine } from '../../core/cart/cart.model';
import { CartService } from '../../core/cart/cart.service';
import { Reveal } from '../../shared/reveal';
import { AhjoomahPeek } from '../../shared/ahjoomah/ahjoomah-peek';
import { VoiceBubble } from '../../shared/voice-bubble/voice-bubble';
import { DishCard } from './dish-card';
import { ListRow } from './list-row';
import { ItemDialog } from './item-dialog/item-dialog';
import { MenuDecor } from './menu-decor';
import { MenuHeader } from './menu-header';
import { MenuDish } from './menu.data';
import { MENU_FILTERS, MenuFilter, filterMenu, isListCategory } from './menu.filters';
import { formatAmount } from '../../shared/format/price';
import { MenuService } from './menu.service';

// How long the "Added to cart" confirmation stays up
const TOAST_MS = 4000;
// A section counts as the one being read once its top is within this slack of the scroll-margin
// line (the section's own scroll-mt, i.e. where a nav pill click lands it)
const SPY_SLACK_PX = 8;
// After a drag ends, leave the nav where the guest put it for this long
const DRAG_QUIET_MS = 1000;

// Menu page in the dusk palette: a golden-hour header with a setting sun, a sticky category
// nav, then one section per category as the sky darkens: dish cards, or a priced list for
// list sections (drinks, off menu).
@Component({
  selector: 'app-menu',
  imports: [
    RouterLink,
    Reveal,
    AhjoomahPeek,
    VoiceBubble,
    DishCard,
    ListRow,
    ItemDialog,
    MenuHeader,
    MenuDecor,
  ],
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

  // Filter chips and which of them are on; several on at once must all match
  protected readonly filters = MENU_FILTERS;
  protected readonly activeFilters = signal<ReadonlySet<MenuFilter>>(new Set());
  // The categories left after filtering; the nav pills and the sections both render from this
  protected readonly visibleCategories = computed(() =>
    filterMenu(this.categories(), this.activeFilters()),
  );
  protected readonly totalDishes = computed(() =>
    this.categories().reduce((sum, c) => sum + c.dishes.length, 0),
  );
  protected readonly visibleDishes = computed(() =>
    this.visibleCategories().reduce((sum, c) => sum + c.dishes.length, 0),
  );
  // Ids of list-layout sections, decided on the unfiltered menu so filtering never changes layout
  protected readonly listIds = computed(
    () =>
      new Set(
        this.categories()
          .filter(isListCategory)
          .map((c) => c.id),
      ),
  );

  // The category section in view, which lights up its pill in the nav
  protected readonly activeId = signal<string | null>(null);
  private readonly navList = viewChild<ElementRef<HTMLElement>>('navList');
  // True while a mouse drag is scrolling the nav; the time it last ended keeps auto-centring off
  protected readonly dragging = signal(false);
  private dragEndedAt = 0;
  // Grab cursor on the nav and its pills whenever there is something to drag
  protected readonly navCursor = computed(() =>
    this.dragging()
      ? 'cursor-grabbing'
      : this.canScrollLeft() || this.canScrollRight()
        ? 'cursor-grab'
        : '',
  );
  // Whether the nav has more pills hidden to the left or right (drives the md+ arrows)
  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);
  private readonly sections = viewChildren<ElementRef<HTMLElement>>('section');
  private readonly destroyRef = inject(DestroyRef);

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
    formatAmount(this.cart.totalMinor(), this.cart.currency()),
  );

  constructor() {
    afterNextRender(() => {
      this.watchScroll();
      this.hydrated.set(true);
    });
    // Filtering changes which sections exist and shifts the layout: once it settles, refresh the
    // reveal triggers (so unrevealed cards are not stuck hidden) and re-pick the active section
    effect((onCleanup) => {
      this.visibleCategories();
      if (this.hydrated()) {
        const frame = requestAnimationFrame(() => {
          // ScrollTrigger needs matchMedia, which some environments (jsdom) lack
          if (typeof window.matchMedia === 'function') {
            ScrollTrigger.refresh();
          }
          this.updateActive();
        });
        onCleanup(() => cancelAnimationFrame(frame));
      }
    });
    // Track whether the nav can scroll either way; re-measure on scroll, on size changes of the
    // list or its pills (resize, fonts loading) and after filtering
    effect((onCleanup) => {
      const list = this.navList()?.nativeElement;
      this.visibleCategories();
      if (!list || !this.hydrated()) {
        this.canScrollLeft.set(false);
        this.canScrollRight.set(false);
        return;
      }
      const measure = () => {
        const left = list.scrollLeft > 1;
        const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
        this.canScrollLeft.set(left);
        this.canScrollRight.set(right);
      };
      list.addEventListener('scroll', measure, { passive: true });
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
      // After the pills have rendered: measure, then watch the list and each pill
      const frame = requestAnimationFrame(() => {
        measure();
        observer?.observe(list);
        list.querySelectorAll('li').forEach((li) => observer?.observe(li));
      });
      onCleanup(() => {
        list.removeEventListener('scroll', measure);
        observer?.disconnect();
        cancelAnimationFrame(frame);
      });
    });
    // Mouse drag scrolls the nav (touch and pen keep their native swipe)
    effect((onCleanup) => {
      const list = this.navList()?.nativeElement;
      if (!list || !this.hydrated()) {
        return;
      }
      const DRAG_THRESHOLD_PX = 5;
      let pressed = false;
      let startX = 0;
      let startScroll = 0;
      let swallowClick = false;
      let swallowTimer: ReturnType<typeof setTimeout> | undefined;
      const down = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) {
          return;
        }
        pressed = true;
        swallowClick = false;
        startX = e.clientX;
        startScroll = list.scrollLeft;
      };
      const move = (e: PointerEvent) => {
        if (!pressed) {
          return;
        }
        const dx = e.clientX - startX;
        if (!this.dragging() && Math.abs(dx) > DRAG_THRESHOLD_PX) {
          this.dragging.set(true);
          // Keep receiving moves even when the pointer leaves the nav
          if (typeof list.setPointerCapture === 'function') {
            list.setPointerCapture(e.pointerId);
          }
        }
        if (this.dragging()) {
          list.scrollLeft = startScroll - dx;
        }
      };
      const up = () => {
        if (!pressed) {
          return;
        }
        pressed = false;
        if (this.dragging()) {
          this.dragging.set(false);
          this.dragEndedAt = Date.now();
          // The click that ends a drag must not follow a pill link; drop the flag if none comes
          swallowClick = true;
          swallowTimer = setTimeout(() => (swallowClick = false), 0);
        }
      };
      const click = (e: MouseEvent) => {
        if (swallowClick) {
          swallowClick = false;
          e.preventDefault();
          e.stopPropagation();
        }
      };
      // No native dragging of the pill links
      const noDrag = (e: Event) => e.preventDefault();
      list.addEventListener('pointerdown', down);
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerup', up);
      list.addEventListener('pointercancel', up);
      list.addEventListener('click', click, true);
      list.addEventListener('dragstart', noDrag);
      onCleanup(() => {
        list.removeEventListener('pointerdown', down);
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerup', up);
        list.removeEventListener('pointercancel', up);
        list.removeEventListener('click', click, true);
        list.removeEventListener('dragstart', noDrag);
        clearTimeout(swallowTimer);
      });
    });
    // Keep the active pill centered in the sideways-scrolling nav, unless the guest is dragging it
    effect((onCleanup) => {
      const id = this.activeId();
      if (id && this.hydrated()) {
        const busy = untracked(
          () => this.dragging() || Date.now() - this.dragEndedAt < DRAG_QUIET_MS,
        );
        if (busy) {
          return;
        }
        // Wait a frame so the pill's new state is rendered before measuring
        const frame = requestAnimationFrame(() => this.centerPill(id));
        onCleanup(() => cancelAnimationFrame(frame));
      }
    });
    // The address lost its item (Back button, manual edit): nothing is open in-page any more
    effect(() => {
      if (!this.itemId()) {
        this.openedInPage = false;
      }
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  // Hanok eaves with lanterns sit beside a few sections, alternating sides (visible-list index)
  protected eaveSide(index: number): 'left' | 'right' | null {
    const sides: Record<number, 'left' | 'right'> = { 1: 'right', 4: 'left', 7: 'right' };
    return sides[index] ?? null;
  }


  // Flip one filter chip; the set is replaced so the signal notices
  protected toggleFilter(id: MenuFilter): void {
    this.activeFilters.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  // Turn every filter off
  protected clearFilters(): void {
    this.activeFilters.set(new Set());
  }

  // Browser only: follow the scroll, at most once per frame, and stop when the page goes away
  private watchScroll(): void {
    let frame = 0;
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.updateActive();
        });
      }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Pick the starting section, e.g. after a reload part-way down
    schedule();
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    });
  }

  // The active section is the last one whose top has passed the line under the sticky nav; at the
  // very bottom of the page the last section wins, since a short one may never reach the line
  private updateActive(): void {
    const sections = this.sections().map((s) => s.nativeElement);
    // A page too short to scroll never counts as "at the bottom"
    const atBottom =
      window.scrollY > 0 &&
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let current: string | null = null;
    for (const section of sections) {
      // The line comes from the section's own scroll-mt, so spy and pill-click landing agree
      const line = (parseFloat(getComputedStyle(section).scrollMarginTop) || 0) + SPY_SLACK_PX;
      if (atBottom || section.getBoundingClientRect().top <= line) {
        current = section.id;
      }
    }
    this.activeId.set(atBottom ? (sections.at(-1)?.id ?? null) : current);
  }

  // Smooth scrolling unless the guest prefers reduced motion
  private scrollBehavior(): ScrollBehavior {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return reduce ? 'auto' : 'smooth';
  }

  // Scroll the nav sideways so the pill sits in the middle (no-op when everything fits)
  private centerPill(id: string): void {
    const list = this.navList()?.nativeElement;
    const pill = list?.querySelector<HTMLElement>(`[data-nav-id="${id}"]`);
    if (!list || !pill || typeof list.scrollTo !== 'function') {
      return;
    }
    list.scrollTo({
      left: pill.offsetLeft - (list.clientWidth - pill.offsetWidth) / 2,
      behavior: this.scrollBehavior(),
    });
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

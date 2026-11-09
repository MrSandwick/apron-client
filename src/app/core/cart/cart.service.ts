import { DestroyRef, Injectable, afterNextRender, computed, inject, signal } from '@angular/core';
import {
  CartLine,
  CartPick,
  MAX_QUANTITY,
  MIN_QUANTITY,
  NewCartLine,
  clampQuantity,
  lineKey,
} from './cart.model';

// Where the cart is kept between visits
export const CART_STORAGE_KEY = 'ahjoomah-cart-v1';

// A stored cart older than this is dropped, so old notes and prices do not live forever
export const CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function withQuantity(line: CartLine, quantity: number): CartLine {
  const next = clampQuantity(quantity);
  return { ...line, quantity: next, totalMinor: line.unitMinor * next };
}

const isMinor = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isPick(v: unknown): v is CartPick {
  const p = v as Record<string, unknown> | null;
  return (
    p !== null &&
    typeof p === 'object' &&
    typeof p['groupId'] === 'string' &&
    typeof p['groupName'] === 'string' &&
    typeof p['choiceId'] === 'string' &&
    typeof p['choiceName'] === 'string' &&
    isMinor(p['extraMinor'])
  );
}

// A stored line is kept only if every field has the right shape; bad lines are dropped one by one
function isStoredLine(v: unknown): v is CartLine {
  const l = v as Record<string, unknown> | null;
  return (
    l !== null &&
    typeof l === 'object' &&
    typeof l['dishId'] === 'string' &&
    typeof l['name'] === 'string' &&
    (l['code'] === undefined || typeof l['code'] === 'string') &&
    typeof l['note'] === 'string' &&
    typeof l['currency'] === 'string' &&
    /^[A-Z]{3}$/.test(l['currency']) &&
    isMinor(l['unitMinor']) &&
    Number.isInteger(l['quantity']) &&
    (l['quantity'] as number) >= MIN_QUANTITY &&
    (l['quantity'] as number) <= MAX_QUANTITY &&
    Array.isArray(l['picks']) &&
    l['picks'].every(isPick)
  );
}

// Reads the stored value: the current { savedAt, lines } shape, or the bare array an earlier
// build wrote. A bare array has no timestamp and is treated as fresh (it gets stamped on the
// next save). Expired, malformed or mixed-currency data yields only what is valid.
function parseStored(raw: unknown, now: number): CartLine[] {
  let list: unknown = raw;
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const savedAt = (raw as Record<string, unknown>)['savedAt'];
    if (typeof savedAt !== 'number' || now - savedAt > CART_MAX_AGE_MS) {
      return [];
    }
    list = (raw as Record<string, unknown>)['lines'];
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const lines = list
    .filter(isStoredLine)
    .map((l) => withQuantity({ ...l, key: lineKey(l) }, l.quantity));
  // Single currency: keep the lines that match the first
  return lines.filter((l) => l.currency === lines[0].currency);
}

// The guest's cart: signals in memory, mirrored to localStorage in the browser
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _lines = signal<CartLine[]>([]);
  readonly lines = this._lines.asReadonly();
  // Total number of portions across all lines
  readonly count = computed(() => this._lines().reduce((sum, l) => sum + l.quantity, 0));
  readonly totalMinor = computed(() => this._lines().reduce((sum, l) => sum + l.totalMinor, 0));
  // Currency of the cart, taken from its first line
  readonly currency = computed(() => this._lines()[0]?.currency ?? 'USD');
  // False until the stored cart was read, so an early save cannot overwrite it
  private loaded = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Read after first render in the browser so server and browser HTML match
    afterNextRender(() => {
      this.load();
      // Another tab changed the cart: follow it
      const onStorage = (event: StorageEvent) => {
        if (event.key === CART_STORAGE_KEY || event.key === null) {
          this._lines.set(this.read());
        }
      };
      window.addEventListener('storage', onStorage);
      destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
    });
  }

  // Adds a line, merging with an identical one. Returns false, changing nothing, when the line
  // is in a different currency from the cart
  add(line: NewCartLine): boolean {
    const existing = this._lines()[0];
    if (existing && existing.currency !== line.currency) {
      return false;
    }
    const key = lineKey(line);
    const quantity = clampQuantity(line.quantity);
    this._lines.update((lines) => {
      const same = lines.find((l) => l.key === key);
      if (same) {
        return lines.map((l) => (l === same ? withQuantity(l, l.quantity + quantity) : l));
      }
      return [...lines, withQuantity({ ...line, key, totalMinor: 0 }, quantity)];
    });
    this.save();
    return true;
  }

  remove(key: string): void {
    this._lines.update((lines) => lines.filter((l) => l.key !== key));
    this.save();
  }

  setQuantity(key: string, quantity: number): void {
    this._lines.update((lines) =>
      lines.map((l) => (l.key === key ? withQuantity(l, quantity) : l)),
    );
    this.save();
  }

  clear(): void {
    this._lines.set([]);
    this.save();
  }

  // The valid stored lines, or none when storage is empty, blocked, corrupt or expired
  private read(): CartLine[] {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? parseStored(JSON.parse(raw), Date.now()) : [];
    } catch {
      return [];
    }
  }

  private load(): void {
    const early = this._lines();
    this._lines.set(this.read());
    this.loaded = true;
    // Lines added before the read finished stay on top of the stored ones, then everything is saved
    for (const line of early) {
      this.add(line);
    }
    if (early.length) {
      this.save();
    }
  }

  private save(): void {
    if (!this.loaded) {
      return;
    }
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), lines: this._lines() }),
      );
    } catch {
      // Storage full or blocked: the cart still works for this visit
    }
  }
}

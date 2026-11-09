import { TestBed } from '@angular/core/testing';
import { NewCartLine } from './cart.model';
import { CART_MAX_AGE_MS, CART_STORAGE_KEY, CartService } from './cart.service';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const line = (over: Partial<NewCartLine> = {}): NewCartLine => ({
  dishId: 'd1',
  name: 'Galbi',
  quantity: 1,
  picks: [
    { groupId: 'g', groupName: 'Cut', choiceId: 'a', choiceName: 'A', extraMinor: 0 },
    { groupId: 'h', groupName: 'Side', choiceId: 'b', choiceName: 'B', extraMinor: 100 },
  ],
  note: '',
  unitMinor: 2000,
  currency: 'USD',
  ...over,
});

// Builds a cart over the given fake storage and lets the post-render read run
function make(storage = fakeStorage()) {
  vi.stubGlobal('localStorage', storage);
  TestBed.configureTestingModule({});
  const cart = TestBed.inject(CartService);
  TestBed.tick();
  return { cart, storage };
}

describe('CartService', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Identical dish, picks and note merge into one line with added quantities
  it('merges identical lines and adds quantities', () => {
    const { cart } = make();
    cart.add(line({ quantity: 2 }));
    cart.add(line({ quantity: 3, picks: [...line().picks].reverse() }));
    expect(cart.lines().length).toBe(1);
    expect(cart.lines()[0].quantity).toBe(5);
    expect(cart.lines()[0].totalMinor).toBe(10000);
  });

  // A different note or pick keeps a separate line
  it('keeps lines apart when picks or note differ', () => {
    const { cart } = make();
    cart.add(line());
    cart.add(line({ note: 'no sesame' }));
    cart.add(line({ picks: [] }));
    expect(cart.lines().length).toBe(3);
  });

  // Count and total follow the lines
  it('computes count and total', () => {
    const { cart } = make();
    cart.add(line({ quantity: 2 }));
    cart.add(line({ dishId: 'd2', unitMinor: 500, quantity: 1 }));
    expect(cart.count()).toBe(3);
    expect(cart.totalMinor()).toBe(4500);
  });

  // Quantity is clamped from 1 to 20, and merging cannot pass 20
  it('clamps quantity', () => {
    const { cart } = make();
    cart.add(line({ quantity: 15 }));
    const key = cart.lines()[0].key;
    cart.setQuantity(key, 0);
    expect(cart.lines()[0].quantity).toBe(1);
    cart.setQuantity(key, 50);
    expect(cart.lines()[0].quantity).toBe(20);
    cart.add(line({ quantity: 10 }));
    expect(cart.lines()[0].quantity).toBe(20);
  });

  // Remove and clear empty the cart
  it('removes a line and clears the cart', () => {
    const { cart } = make();
    cart.add(line());
    cart.add(line({ dishId: 'd2' }));
    cart.remove(cart.lines()[0].key);
    expect(cart.lines().length).toBe(1);
    cart.clear();
    expect(cart.count()).toBe(0);
  });

  // Every change is written to storage under the versioned key
  it('writes to storage under the cart key', () => {
    const { cart, storage } = make();
    cart.add(line({ quantity: 2 }));
    const saved = JSON.parse(storage.data[CART_STORAGE_KEY]);
    expect(CART_STORAGE_KEY).toBe('ahjoomah-cart-v1');
    expect(saved.lines[0].quantity).toBe(2);
    expect(typeof saved.savedAt).toBe('number');
  });

  // A stored cart is read back after first render
  it('reads a stored cart', () => {
    const first = make();
    first.cart.add(line({ quantity: 4 }));
    TestBed.resetTestingModule();
    const { cart } = make(first.storage);
    expect(cart.count()).toBe(4);
    expect(cart.lines()[0].name).toBe('Galbi');
  });

  // Corrupt or malformed data is ignored without throwing
  it('ignores corrupt stored data', () => {
    const bad = make(fakeStorage({ [CART_STORAGE_KEY]: '{not json' }));
    expect(bad.cart.count()).toBe(0);
    TestBed.resetTestingModule();
    const wrong = make(fakeStorage({ [CART_STORAGE_KEY]: '[{"x":1},null,5]' }));
    expect(wrong.cart.count()).toBe(0);
  });

  // Storage that throws must not break the cart
  it('works when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', throwing);
    TestBed.configureTestingModule({});
    const cart = TestBed.inject(CartService);
    TestBed.tick();
    cart.add(line());
    expect(cart.count()).toBe(1);
  });

  const stored = (over: Record<string, unknown> = {}) => ({ ...line(), quantity: 2, ...over });
  const wrap = (lines: unknown[], savedAt = Date.now()) => JSON.stringify({ savedAt, lines });

  // One bad line is dropped and the good ones stay
  it('drops only the invalid stored lines', () => {
    const { cart } = make(
      fakeStorage({
        [CART_STORAGE_KEY]: wrap([
          stored(),
          stored({ dishId: 'd2', unitMinor: -5 }),
          stored({ dishId: 'd3', unitMinor: 1.5 }),
          stored({ dishId: 'd4', quantity: 99 }),
          stored({ dishId: 'd5', currency: 'usd' }),
          stored({ dishId: 'd6', picks: [{ groupId: 1 }] }),
          stored({ dishId: 'd7', currency: 'EUR' }),
        ]),
      }),
    );
    expect(cart.lines().map((l) => l.dishId)).toEqual(['d1']);
  });

  // An old bare-array save from an earlier build is read as fresh
  it('reads a legacy bare-array save as fresh', () => {
    const { cart } = make(fakeStorage({ [CART_STORAGE_KEY]: JSON.stringify([stored()]) }));
    expect(cart.count()).toBe(2);
  });

  // A save older than seven days is ignored
  it('ignores an expired save', () => {
    const old = Date.now() - CART_MAX_AGE_MS - 1000;
    const { cart } = make(fakeStorage({ [CART_STORAGE_KEY]: wrap([stored()], old) }));
    expect(cart.count()).toBe(0);
  });

  // A line in another currency is refused and the cart is unchanged
  it('refuses a line in a different currency', () => {
    const { cart } = make();
    expect(cart.add(line())).toBe(true);
    expect(cart.add(line({ dishId: 'd2', currency: 'EUR' }))).toBe(false);
    expect(cart.lines().length).toBe(1);
  });

  // Lines added before the stored cart is read are kept and saved
  it('saves early lines after the stored cart loads', () => {
    const storage = fakeStorage({ [CART_STORAGE_KEY]: wrap([stored()]) });
    vi.stubGlobal('localStorage', storage);
    const cart = TestBed.inject(CartService);
    cart.add(line({ dishId: 'early' }));
    TestBed.tick();
    expect(cart.lines().map((l) => l.dishId)).toEqual(['d1', 'early']);
    expect(JSON.parse(storage.data[CART_STORAGE_KEY]).lines.length).toBe(2);
  });

  // A storage event from another tab reloads the cart
  it('follows changes made in another tab', () => {
    const { cart, storage } = make();
    cart.add(line());
    storage.data[CART_STORAGE_KEY] = wrap([stored({ dishId: 'other' })]);
    window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
    expect(cart.lines().map((l) => l.dishId)).toEqual(['other']);
    // Other keys are ignored
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    expect(cart.lines().length).toBe(1);
  });
});

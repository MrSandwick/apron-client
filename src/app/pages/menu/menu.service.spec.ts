import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api/api-config';
import { menuFixture } from '../../shared/api/menu.fixture';
import { MENU } from './menu.data';
import { toMenuCategories } from './menu.mapper';
import { MenuResult, MenuService } from './menu.service';

function setup(base?: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...(base ? [{ provide: API_BASE_URL, useValue: base }] : []),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const results: MenuResult[] = [];
  const errors: unknown[] = [];
  TestBed.inject(MenuService)
    .load()
    .subscribe({ next: (r) => results.push(r), error: (e) => errors.push(e) });
  return { http, results, errors };
}

describe('MenuService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests GET /api/v1/menu by default', () => {
    const { http } = setup();
    const req = http.expectOne('/api/v1/menu');
    expect(req.request.method).toBe('GET');
    req.flush(menuFixture);
  });

  it('maps a successful response to source api', () => {
    const { http, results } = setup();
    http.expectOne('/api/v1/menu').flush(menuFixture);
    expect(results).toEqual([{ categories: toMenuCategories(menuFixture), source: 'api' }]);
  });

  it('falls back to the bundled menu on a 500', () => {
    const { http, results, errors } = setup();
    http
      .expectOne('/api/v1/menu')
      .flush({ title: 'Boom' }, { status: 500, statusText: 'Server Error' });
    expect(results).toEqual([{ categories: MENU, source: 'fallback' }]);
    expect(errors).toEqual([]);
  });

  it('falls back when the request times out', () => {
    vi.useFakeTimers();
    const { http, results, errors } = setup();
    http.expectOne('/api/v1/menu');
    vi.advanceTimersByTime(4001);
    expect(results).toEqual([{ categories: MENU, source: 'fallback' }]);
    expect(errors).toEqual([]);
  });

  it('honours a custom API_BASE_URL', () => {
    const { http } = setup('http://api:8000/api/v1');
    http.expectOne('http://api:8000/api/v1/menu').flush(menuFixture);
  });

  it('never errors on a network failure', () => {
    const { http, results, errors } = setup();
    http.expectOne('/api/v1/menu').error(new ProgressEvent('error'));
    expect(results[0].source).toBe('fallback');
    expect(errors).toEqual([]);
  });

  // Server render: a successful fetch is embedded in the page for the browser to reuse
  it('stores a successful result in the transfer state on the server', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(MenuService).load().subscribe();
    http.expectOne('/api/v1/menu').flush(menuFixture);
    const saved = TestBed.inject(TransferState).get(makeStateKey<MenuResult>('menu-result'), null);
    expect(saved?.source).toBe('api');
    expect(saved?.categories.map((c) => c.id)).toEqual(['bbq', 'banchan']);
  });

  // Server render: a fallback is not handed to the browser, so the browser retries the API
  it('does not store a fallback result in the transfer state', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(MenuService).load().subscribe();
    http.expectOne('/api/v1/menu').flush('boom', { status: 500, statusText: 'Server Error' });
    const saved = TestBed.inject(TransferState).get(makeStateKey<MenuResult>('menu-result'), null);
    expect(saved).toBeNull();
  });

  // Browser after hydration: the server's menu is used at once, with no request and no skeleton
  it('uses the transfer state synchronously and makes no request', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const state = TestBed.inject(TransferState);
    const embedded: MenuResult = { categories: MENU.slice(0, 2), source: 'api' };
    state.set(makeStateKey<MenuResult>('menu-result'), embedded);
    const http = TestBed.inject(HttpTestingController);
    const results: MenuResult[] = [];
    TestBed.inject(MenuService)
      .load()
      .subscribe((r) => results.push(r));
    // Emitted synchronously, before anything could be flushed
    expect(results).toEqual([embedded]);
    http.expectNone('/api/v1/menu');
    // Consumed once, so a later visit fetches fresh data
    expect(state.hasKey(makeStateKey('menu-result'))).toBe(false);
  });
});

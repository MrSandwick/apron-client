import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { MenuDto } from '../../shared/api/menu.dto';
import { MENU, MenuCategory } from './menu.data';
import { toMenuCategories } from './menu.mapper';

// What the menu page renders from: the categories, and where they came from
export interface MenuResult {
  categories: MenuCategory[];
  // 'fallback' means the API was unreachable and the bundled sample menu is shown
  source: 'api' | 'fallback';
}

// The menu the server fetched, embedded in the page so the browser renders the same cards on
// hydration without asking the API again. Keyed by name rather than by request URL, because
// the server may reach the API at a different address than the browser does.
const MENU_STATE = makeStateKey<MenuResult>('menu-result');

// Loads the menu from the API, falling back to the bundled sample menu on any failure
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly state = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  load(): Observable<MenuResult> {
    // First load in the browser after server rendering: use what the server fetched. It is
    // emitted synchronously, so the first render matches the server's HTML (no skeleton flash)
    const saved = this.state.get(MENU_STATE, null);
    if (saved) {
      // Removed so a later visit to the page fetches fresh data
      this.state.remove(MENU_STATE);
      return of(saved);
    }
    return (
      this.http
        // transferCache is off because MENU_STATE already carries this response once
        .get<MenuDto>(`${this.base}/menu`, { transferCache: false })
        .pipe(
          timeout(4000),
          map((dto): MenuResult => ({ categories: toMenuCategories(dto), source: 'api' })),
          // Never error to the caller: errors and timeouts show the bundled menu
          catchError(() => of<MenuResult>({ categories: MENU, source: 'fallback' })),
          // Hand real data to the browser; a fallback is not passed on, so the browser retries
          tap((result) => {
            if (this.isServer && result.source === 'api') {
              this.state.set(MENU_STATE, result);
            }
          }),
        )
    );
  }
}

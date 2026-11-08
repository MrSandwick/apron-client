import { InjectionToken } from '@angular/core';

// Base URL of the REST API. Relative so the browser calls the same origin; the SSR server
// overrides it with an absolute internal URL (see app.config.server.ts)
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});

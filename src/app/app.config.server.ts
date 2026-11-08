import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { API_BASE_URL } from './core/api/api-config';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

// Absolute API origin for the SSR server (for example http://api:8000); unset in ng serve
const apiInternalUrl = process.env['API_INTERNAL_URL'];

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // The server cannot use a relative URL, so point it straight at the API when configured
    ...(apiInternalUrl
      ? [{ provide: API_BASE_URL, useValue: `${apiInternalUrl.replace(/\/+$/, '')}/api/v1` }]
      : []),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

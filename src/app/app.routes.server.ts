import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Menu is rendered per request (briefly cached) so later database edits show up; prerendering would freeze it at build time
  {
    path: 'menu',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'menu',
    title: "Menu | Ahjoomah's",
    loadComponent: () => import('./pages/menu/menu').then((m) => m.Menu),
  },
];

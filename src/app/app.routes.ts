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
  {
    path: 'cart',
    title: "Your cart | Ahjoomah's",
    loadComponent: () => import('./pages/cart/cart').then((m) => m.CartPage),
  },
  {
    path: 'reservations',
    title: "Reservations | Ahjoomah's",
    loadComponent: () => import('./reservations/reservations').then((m) => m.ReservationsPage),
  },
  // The old order link lands on the cart
  { path: 'order', redirectTo: 'cart', pathMatch: 'full' },
];

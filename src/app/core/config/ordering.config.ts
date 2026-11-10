import { InjectionToken } from '@angular/core';

// Where guests go to order delivery. Placeholder: the real store URL is still to be supplied
export const DELIVERY_URL = new InjectionToken<string>('DELIVERY_URL', {
  providedIn: 'root',
  factory: () => 'https://www.ubereats.com/',
});

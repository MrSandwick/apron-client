import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';

describe('routes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  // The retired order link must land on the cart page
  it('redirects /order to /cart', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/order');
    expect(router.url).toBe('/cart');
  });
});

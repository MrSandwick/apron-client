import { TestBed } from '@angular/core/testing';
import { TweenedAmount } from './tweened-amount';

describe('TweenedAmount', () => {
  // Build the component with an amount and a currency, then let it render once
  async function mount(amountMinor: number, currency = 'USD') {
    const fixture = TestBed.createComponent(TweenedAmount);
    fixture.componentRef.setInput('amountMinor', amountMinor);
    fixture.componentRef.setInput('currency', currency);
    await fixture.whenStable();
    return fixture;
  }

  it('starts on the real amount instead of counting up from zero', async () => {
    const fixture = await mount(5000);

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('$50');
  });

  it('shows a changed amount right away when motion is unavailable', async () => {
    const fixture = await mount(5000);

    // The test-setup matchMedia stub reports no motion preference, so the tween jumps
    fixture.componentRef.setInput('amountMinor', 5650);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('$56.50');
  });

  it('prints a zero amount as $0, not the unpriced placeholder', async () => {
    const fixture = await mount(0);

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('$0');
  });
});

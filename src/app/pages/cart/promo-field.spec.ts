import { TestBed } from '@angular/core/testing';
import { PromoField } from './promo-field';

async function mount() {
  const fixture = TestBed.createComponent(PromoField);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('input')!;
  const button = el.querySelector<HTMLButtonElement>('button')!;
  const status = el.querySelector<HTMLElement>('[role="status"]')!;

  // Types a value into the input the way a guest would
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { fixture, el, input, button, status, type };
}

describe('PromoField', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PromoField] }).compileComponents();
  });

  // The input has a visible label tied to it
  it('labels the input "Promo code"', async () => {
    const { el, input } = await mount();
    const label = el.querySelector('label');
    expect(label?.textContent?.trim()).toBe('Promo code');
    expect(label?.getAttribute('for')).toBe(input.id);
  });

  // The status element is linked to the input and is a polite live region
  it('links a polite status element to the input', async () => {
    const { input, status } = await mount();
    expect(status.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe(status.id);
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  // Nothing is said before the guest tries
  it('shows no message until Apply is used', async () => {
    const { status } = await mount();
    expect(status.textContent?.trim()).toBe('');
  });

  // A blank code asks for input
  it('asks for a code when Apply is pressed on a blank input', async () => {
    const { fixture, button, status } = await mount();
    button.click();
    await fixture.whenStable();
    expect(status.textContent?.trim()).toBe('Enter a code to apply');
  });

  // Whitespace alone counts as blank
  it('treats a whitespace-only code as blank', async () => {
    const { fixture, button, status, type } = await mount();
    type('   ');
    button.click();
    await fixture.whenStable();
    expect(status.textContent?.trim()).toBe('Enter a code to apply');
  });

  // Any real code gets the coming-soon note
  it('says promo codes are coming soon for a non-blank code', async () => {
    const { fixture, button, status, type } = await mount();
    type(' SPRING10 ');
    button.click();
    await fixture.whenStable();
    expect(status.textContent?.trim()).toBe('Promo codes are coming soon');
  });

  // The message swaps when the guest clears the code and applies again
  it('updates the message when the input changes between applies', async () => {
    const { fixture, button, status, type } = await mount();
    type('SPRING10');
    button.click();
    await fixture.whenStable();
    type('');
    button.click();
    await fixture.whenStable();
    expect(status.textContent?.trim()).toBe('Enter a code to apply');
  });

  // Applying only reports status: the typed code stays and no other text appears
  it('changes nothing but the status message', async () => {
    const { fixture, el, input, button, type } = await mount();
    type('SPRING10');
    // Everything outside the status element, as plain text
    const rest = () =>
      Array.from(el.querySelectorAll('label, button'))
        .map((n) => n.textContent?.trim())
        .join('|');
    const before = rest();
    button.click();
    await fixture.whenStable();
    expect(input.value).toBe('SPRING10');
    expect(rest()).toBe(before);
  });

  // Instances on one page must not share ids
  it('gives each instance unique ids', async () => {
    const a = await mount();
    const b = await mount();
    expect(a.input.id).not.toBe(b.input.id);
    expect(a.status.id).not.toBe(b.status.id);
  });
});

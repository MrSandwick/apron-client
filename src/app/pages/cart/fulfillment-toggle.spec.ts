import { TestBed } from '@angular/core/testing';
import { FulfillmentToggle } from './fulfillment-toggle';

async function mount() {
  const fixture = TestBed.createComponent(FulfillmentToggle);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  return { fixture, el, radios };
}

describe('FulfillmentToggle', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FulfillmentToggle] }).compileComponents();
  });

  // The group is a fieldset named by its legend
  it('renders a fieldset with the question as its legend', async () => {
    const { el } = await mount();
    expect(el.querySelector('fieldset > legend')?.textContent?.trim()).toBe(
      'How would you like your order?',
    );
  });

  // Two native radios share one name so arrow keys move between them
  it('renders Takeout and Delivery as radios in one group', async () => {
    const { el, radios } = await mount();
    expect(radios.length).toBe(2);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(el.textContent).toContain('Takeout');
    expect(el.textContent).toContain('Delivery');
  });

  // Takeout is the default choice
  it('defaults to takeout', async () => {
    const { fixture, radios } = await mount();
    expect(fixture.componentInstance.mode()).toBe('takeout');
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
  });

  // Picking delivery updates the model
  it('sets the model to delivery when Delivery is chosen', async () => {
    const { fixture, radios } = await mount();
    radios[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.mode()).toBe('delivery');
    expect(radios[1].checked).toBe(true);
  });

  // Picking takeout again switches back
  it('sets the model back to takeout', async () => {
    const { fixture, radios } = await mount();
    radios[1].click();
    radios[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.mode()).toBe('takeout');
  });

  // A parent setting the model moves the checked radio
  it('reflects the model when it is set from outside', async () => {
    const { fixture, radios } = await mount();
    fixture.componentRef.setInput('mode', 'delivery');
    await fixture.whenStable();
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  // The model emits so a parent can two-way bind it
  it('emits modeChange when the choice changes', async () => {
    const { fixture, radios } = await mount();
    const seen: string[] = [];
    fixture.componentInstance.mode.subscribe((m) => seen.push(m));
    radios[1].click();
    await fixture.whenStable();
    expect(seen).toEqual(['delivery']);
  });

  // The sliding indicator is decorative and sits on the second pill only for delivery
  it('moves the aria-hidden indicator with the mode', async () => {
    const { fixture, el } = await mount();
    const indicator = el.querySelector('[data-testid="fulfillment-indicator"]')!;
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(indicator.className).not.toContain('translate-x-[calc(100%+0.25rem)]');
    fixture.componentRef.setInput('mode', 'delivery');
    await fixture.whenStable();
    expect(indicator.classList.contains('translate-x-[calc(100%+0.25rem)]')).toBe(true);
    fixture.componentRef.setInput('mode', 'takeout');
    await fixture.whenStable();
    expect(indicator.className).not.toContain('translate-x-[calc(100%+0.25rem)]');
  });

  // Each target is at least 44px tall
  it('gives each option a min-h-11 target', async () => {
    const { el } = await mount();
    const faces = el.querySelectorAll('input[type="radio"] + span');
    expect(faces.length).toBe(2);
    faces.forEach((face) => expect(face.classList.contains('min-h-11')).toBe(true));
  });
});

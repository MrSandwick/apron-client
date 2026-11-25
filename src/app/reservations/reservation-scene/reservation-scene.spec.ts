import { TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { ReservationScene } from './reservation-scene';

async function setup() {
  await TestBed.configureTestingModule({ imports: [ReservationScene] }).compileComponents();
  const fixture = TestBed.createComponent(ReservationScene);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ReservationScene', () => {
  // The scene is decoration only: hidden from assistive tech and never a pointer target
  it('is hidden from assistive tech and ignores the pointer', async () => {
    const { el } = await setup();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains('pointer-events-none')).toBe(true);
  });

  // It holds no controls, and its only lettering is the RESERVED card, in English and Korean
  it('holds no controls and only the RESERVED card lettering', async () => {
    const { el } = await setup();
    expect(el.querySelector('button, input, select, a, [tabindex]')).toBeNull();
    expect(el.textContent?.replace(/\s+/g, ' ').trim()).toBe('RESERVED 예약석');
  });

  // Four depth layers, far to near, each with one intro child that pops in on entry
  it('stacks bokeh, room, pendants and table as depth layers', async () => {
    const { el } = await setup();
    const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-layer]'));
    expect(layers.map((l) => l.dataset['layer'])).toEqual(['bokeh', 'room', 'pendants', 'table']);
    expect(layers.map((l) => l.dataset['depth'])).toEqual(['0', '0.15', '0.35', '1']);
    expect(el.querySelectorAll('[data-layer] > [data-intro]').length).toBe(4);
  });

  // The table carries the whole setting, staged at several depths: card, rice bowl, utensils, kimchi,
  // soju, stew pot, spinach and two glasses
  it('stages the card, rice, utensils, side dishes, stew pot, soju and glasses on the table', async () => {
    const { el } = await setup();
    const table = el.querySelector('[data-layer="table"]')!;
    expect(table.querySelectorAll('[data-prop]').length).toBe(9);
    expect(table.querySelector('text')?.textContent).toBe('RESERVED');
    expect(table.querySelectorAll('[data-steam]').length).toBe(3);
  });

  // Props are put down back to front: every one has a landing order, and the utensils slide in
  it('gives every prop a landing order, with the utensils sliding in', async () => {
    const { el } = await setup();
    const props = Array.from(el.querySelectorAll<SVGGElement>('[data-layer="table"] [data-prop]'));
    expect(props.every((p) => Number.isFinite(Number(p.dataset['order'])))).toBe(true);
    expect(props.filter((p) => p.hasAttribute('data-slide')).length).toBe(1);
    // The tall soju bottle at the back goes down first, the glasses at the front last
    expect(props.find((p) => p.dataset['order'] === '1')?.querySelector('path')).toBeTruthy();
    expect(Math.max(...props.map((p) => Number(p.dataset['order'])))).toBe(8);
  });

  // The tabletop planks all run to one vanishing point, so the table reads as receding
  it('draws converging planks and a front edge on the table', async () => {
    const { el } = await setup();
    const planks = el.querySelectorAll('[data-layer="table"] svg path[d^="M800 -700"]');
    expect(planks.length).toBe(17);
  });

  // A night-coloured skirt under the table keeps the room hidden when the layer shifts with the cursor
  it('skirts the bottom of the table so parallax never exposes the room', async () => {
    const { el } = await setup();
    const skirt = el.querySelector('[data-layer="table"] .top-full');
    expect(skirt?.classList.contains('to-sky-night')).toBe(true);
  });

  // Four brass pendants hang from the ceiling, and bokeh fills the back of the room
  it('hangs four pendants and draws the bokeh', async () => {
    const { el } = await setup();
    expect(el.querySelectorAll('[data-pendant]').length).toBe(4);
    expect(el.querySelectorAll('[data-bokeh]').length).toBeGreaterThan(10);
  });

  // The table slides sideways with the cursor but is marked x-only, so the room never shows under it
  it('keeps the table from moving vertically with the cursor', async () => {
    const { el } = await setup();
    expect(el.querySelector('[data-layer="table"]')?.hasAttribute('data-pointer-x-only')).toBe(true);
  });

  // The utensils are solid steel: no semi-transparent fills to see the table through
  it('draws the chopsticks and spoon in solid steel', async () => {
    const { el } = await setup();
    const steel = Array.from(el.querySelectorAll('[data-layer="table"] [class*="sky-dawn"]'));
    expect(steel.length).toBeGreaterThan(0);
    expect(steel.every((n) => !/sky-dawn\//.test(n.getAttribute('class') ?? ''))).toBe(true);
  });

  // The test matchMedia never allows motion, like a reduced-motion visitor, so nothing steams or loops
  it('starts no animation when motion is not allowed', async () => {
    const { el } = await setup();
    expect(gsap.getTweensOf(el.querySelector('[data-steam]')).length).toBe(0);
    expect(gsap.getTweensOf(el.querySelector('[data-sway]')).length).toBe(0);
  });
});

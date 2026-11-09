import { TestBed } from '@angular/core/testing';
import { MenuDecor, MenuDecorKind, MenuDecorSide } from './menu-decor';

const KINDS: MenuDecorKind[] = ['eave'];
// Kinds that live in the side margins and show from xl up
const MARGIN_KINDS: MenuDecorKind[] = ['eave'];

async function mount(kind: MenuDecorKind, side?: MenuDecorSide): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(MenuDecor);
  fixture.componentRef.setInput('kind', kind);
  if (side) {
    fixture.componentRef.setInput('side', side);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('MenuDecor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MenuDecor] }).compileComponents();
  });

  // Every kind is a hidden, click-through layer with drawn content and no readable text
  KINDS.forEach((kind) => {
    it(`renders ${kind} as an aria-hidden svg layer with no text`, async () => {
      const el = await mount(kind);
      expect(el.getAttribute('data-testid')).toBe('menu-decor');
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.className).toContain('pointer-events-none');
      expect(el.querySelector('svg')).toBeTruthy();
      expect(el.textContent?.trim()).toBe('');
      expect(el.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
    });
  });

  // Margin decor only exists where the page leaves real room beside the content
  MARGIN_KINDS.forEach((kind) => {
    it(`hides ${kind} below xl on either side`, async () => {
      for (const side of ['left', 'right'] as const) {
        const el = await mount(kind, side);
        expect(el.className).toContain('hidden');
        expect(el.className).toContain('xl:block');
      }
    });
  });

  // The eave is a roof svg with two lanterns hanging below it, each lantern an svg child
  it('draws the eave with two swaying svg lanterns', async () => {
    const el = await mount('eave', 'left');
    const lanterns = el.querySelectorAll('[data-sway]');
    expect(lanterns.length).toBe(2);
    lanterns.forEach((l) => {
      expect(l.querySelector('svg')).toBeTruthy();
      expect(l.querySelector('[data-glow]')).toBeTruthy();
    });
    expect(el.querySelectorAll('svg').length).toBe(3);
  });

  // The eave tucks behind its heading bar and reaches into the margin on its own side
  it('places the eave on the matching side', async () => {
    const leftEave = (await mount('eave', 'left')).className;
    const rightEave = (await mount('eave', 'right')).className;
    expect(leftEave).toContain('right-full');
    expect(leftEave).toContain('-mr-8');
    expect(rightEave).toContain('left-full');
    expect(rightEave).toContain('-ml-8');
    // Starts below the bar's top edge so the roof's flat end never shows above it
    [leftEave, rightEave].forEach((c) => expect(c).toContain('top-3'));
  });

  // The left eave is mirrored so its tip points out into the left margin
  it('mirrors the roof svg on the left side only', async () => {
    const roof = async (side: MenuDecorSide) =>
      (await mount('eave', side)).querySelector('svg')?.getAttribute('class') ?? '';
    expect(await roof('left')).toContain('-scale-x-100');
    expect(await roof('right')).not.toContain('-scale-x-100');
  });

  // Roof tiles use the evening sky colour so the eave blends with the heading bar
  it('fills the roof with the evening sky colour', async () => {
    const el = await mount('eave', 'right');
    expect(el.querySelector('svg path')?.getAttribute('class')).toContain('fill-sky-evening');
  });
});

import { TestBed } from '@angular/core/testing';
import { MenuHeader } from './menu-header';

async function mount(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(MenuHeader);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('MenuHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MenuHeader] }).compileComponents();
  });

  // The page title is the single h1
  it('renders the title "The Menu" as the h1', async () => {
    const el = await mount();
    const headings = el.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('The Menu');
  });

  // The Korean word for menu sits in a seal, marked as Korean for screen readers
  it('shows the 메뉴 seal marked as Korean', async () => {
    const el = await mount();
    const seal = el.querySelector('[data-testid="menu-seal"]');
    expect(seal?.getAttribute('lang')).toBe('ko');
    expect(seal?.textContent?.trim()).toBe('메뉴');
  });

  // The intro line is real text
  it('shows the intro line', async () => {
    const el = await mount();
    expect(el.textContent).toContain('Home-style Korean cooking, made to share.');
  });

  // The brush underline is decoration only, so it is hidden from assistive tech
  it('hides the brush underline svg from assistive tech', async () => {
    const el = await mount();
    const brush = el.querySelector('[data-brush]')?.closest('svg');
    expect(brush).toBeTruthy();
    expect(brush?.getAttribute('aria-hidden')).toBe('true');
  });

  // The clouds and the sun are decoration only
  it('hides the clouds and sun from assistive tech', async () => {
    const el = await mount();
    const clouds = el.querySelector('app-sky-clouds');
    expect(clouds?.closest('[aria-hidden="true"]')).toBeTruthy();
    expect(el.querySelector('[data-sun-rise]')?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  // Uses the home hero's five clouds, so the two skies match
  it('draws the shared hero clouds', async () => {
    const el = await mount();
    expect(el.querySelectorAll('app-sky-clouds [data-cloud]').length).toBe(5);
  });

  // No decoration svg is exposed to assistive tech: each is aria-hidden itself or inside a hidden layer
  it('has no svg outside an aria-hidden element', async () => {
    const el = await mount();
    const svgs = Array.from(el.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => expect(svg.closest('[aria-hidden="true"]')).toBeTruthy());
  });

  // Guards the no-emoji rule for the header copy
  it('renders no emoji', async () => {
    const el = await mount();
    expect(el.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

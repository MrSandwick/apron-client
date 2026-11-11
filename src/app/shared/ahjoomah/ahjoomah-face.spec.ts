import { TestBed } from '@angular/core/testing';
import { AhjoomahFace, AhjoomahFaceMood } from './ahjoomah-face';

describe('AhjoomahFace', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AhjoomahFace] }).compileComponents();
  });

  // Create the face in a given mood and return the fixture's host element
  async function render(mood?: AhjoomahFaceMood) {
    const fixture = TestBed.createComponent(AhjoomahFace);
    if (mood) {
      fixture.componentRef.setInput('mood', mood);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  // Default mood is delighted: open smile, hop motion, no sleepy or waving extras
  it('defaults to delighted with an open smile', async () => {
    const el = await render();
    expect(el.getAttribute('data-mood')).toBe('delighted');
    expect(el.querySelector('[data-part="smile"]')).not.toBeNull();
    expect(el.querySelector('svg')?.classList.contains('motion-safe:animate-mascot-hop')).toBe(
      true,
    );
    expect(el.querySelector('[data-part="zzz"]')).toBeNull();
    expect(el.querySelector('[data-part="hand"]')).toBeNull();
  });

  // Sleepy sets its mood, shows the z marks and the small 'o' mouth, and dozes
  it('renders the sleepy pose', async () => {
    const el = await render('sleepy');
    expect(el.getAttribute('data-mood')).toBe('sleepy');
    expect(el.querySelector('[data-part="zzz"]')).not.toBeNull();
    expect(el.querySelector('[data-part="mouth-o"]')).not.toBeNull();
    expect(el.querySelector('svg')?.classList.contains('motion-safe:animate-mascot-doze')).toBe(
      true,
    );
    expect(el.querySelector('[data-part="smile"]')).toBeNull();
  });

  // Waving sets its mood, winks one eye and shows the waving hand
  it('renders the waving pose', async () => {
    const el = await render('waving');
    expect(el.getAttribute('data-mood')).toBe('waving');
    expect(el.querySelector('[data-part="wink"]')).not.toBeNull();
    const hand = el.querySelector('[data-part="hand"]');
    expect(hand?.classList.contains('motion-safe:animate-mascot-wave')).toBe(true);
    expect(el.querySelector('[data-part="zzz"]')).toBeNull();
  });

  // Changing the mood input swaps the pose in place
  it('swaps the pose when the mood changes', async () => {
    const fixture = TestBed.createComponent(AhjoomahFace);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(el.querySelector('[data-part="smile"]')).not.toBeNull();

    fixture.componentRef.setInput('mood', 'sleepy');
    await fixture.whenStable();
    expect(el.querySelector('[data-part="smile"]')).toBeNull();
    expect(el.querySelector('[data-part="zzz"]')).not.toBeNull();
  });

  // Decorative: hidden from assistive tech on every mood
  it('is aria-hidden on the host', async () => {
    for (const mood of ['sleepy', 'delighted', 'waving'] as const) {
      const el = await render(mood);
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
  });

  // No title, desc or visible text: nearby copy carries the meaning
  it('has no text content', async () => {
    const el = await render('waving');
    expect(el.textContent?.trim()).toBe('');
    expect(el.querySelector('title, desc')).toBeNull();
  });

  // The svg must not take keyboard focus (old IE/Edge quirk guarded by focusable=false)
  it('marks the svg as not focusable', async () => {
    const el = await render();
    expect(el.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });
});

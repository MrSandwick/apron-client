import { TestBed } from '@angular/core/testing';
import { AhjoomahPeek } from './ahjoomah-peek';

describe('AhjoomahPeek', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AhjoomahPeek] }).compileComponents();
  });

  // Renders a clipping frame around a decorative mascot in the static peek position
  it('frames a decorative Ahjoomah', async () => {
    const fixture = TestBed.createComponent(AhjoomahPeek);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const frame = el.querySelector('[data-testid="ahjoomah-peek"]');
    expect(frame?.className).toContain('overflow-hidden');
    expect(frame?.querySelector('[data-testid="ahjoomah"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  // Mood passes through to the mascot
  it('passes its mood to the mascot', async () => {
    const fixture = TestBed.createComponent(AhjoomahPeek);
    fixture.componentRef.setInput('mood', 'happy');
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="eyes-happy"]'),
    ).toBeTruthy();
  });

  // Teardown reverts motion without errors
  it('destroys cleanly', async () => {
    const fixture = TestBed.createComponent(AhjoomahPeek);
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});

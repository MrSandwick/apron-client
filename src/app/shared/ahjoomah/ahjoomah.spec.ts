import { TestBed } from '@angular/core/testing';
import { Ahjoomah } from './ahjoomah';

describe('Ahjoomah', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Ahjoomah] }).compileComponents();
  });

  // Renders as a labelled image and exposes the hooks motion code relies on
  it('renders a labelled mascot with animatable parts', async () => {
    const fixture = TestBed.createComponent(Ahjoomah);
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="ahjoomah"]');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('Ahjoomah');
    for (const part of ['head', 'eyes', 'arms', 'hands', 'pin', 'body', 'apron']) {
      expect(svg?.querySelector(`[data-part="${part}"]`)).not.toBeNull();
    }
  });

  // Default mood matches the logo; "open" swaps in trackable pupils
  it('switches between happy and open eyes', async () => {
    const fixture = TestBed.createComponent(Ahjoomah);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="eyes-happy"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="eyes-open"]')).toBeNull();

    fixture.componentRef.setInput('mood', 'open');
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="eyes-open"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="eyes-happy"]')).toBeNull();
  });

  // Decorative copies stay out of the accessibility tree
  it('hides itself from assistive tech when decorative', async () => {
    const fixture = TestBed.createComponent(Ahjoomah);
    fixture.componentRef.setInput('decorative', true);
    await fixture.whenStable();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="ahjoomah"]');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.hasAttribute('role')).toBe(false);
    expect(svg?.hasAttribute('aria-label')).toBe(false);
  });
});

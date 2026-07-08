import { TestBed } from '@angular/core/testing';
import { SectionCanvas } from './section-canvas';

describe('SectionCanvas', () => {
  // Component instantiates without throwing (WebGL init is guarded/browser-only)
  it('creates', async () => {
    TestBed.configureTestingModule({ imports: [SectionCanvas] });
    const fixture = TestBed.createComponent(SectionCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });

  // Renders the host container the renderer mounts its canvas into
  it('renders the host container', async () => {
    const fixture = TestBed.createComponent(SectionCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('div');
    expect(host).toBeTruthy();
  });

  // Inputs default to a centred amber cube until overridden by the host
  it('defaults to a centred cube', () => {
    const fixture = TestBed.createComponent(SectionCanvas);
    const cmp = fixture.componentInstance;

    expect(cmp.variant()).toBe('cube');
    expect(cmp.align()).toBe('center');
  });

  // Host bindings flow through to the inputs (reserve uses a right-aligned knot)
  it('accepts variant, colour, and alignment overrides', () => {
    const fixture = TestBed.createComponent(SectionCanvas);
    fixture.componentRef.setInput('variant', 'knot');
    fixture.componentRef.setInput('color', '#f5e6c8');
    fixture.componentRef.setInput('align', 'right');

    expect(fixture.componentInstance.variant()).toBe('knot');
    expect(fixture.componentInstance.color()).toBe('#f5e6c8');
    expect(fixture.componentInstance.align()).toBe('right');
  });

  // Teardown is safe even when WebGL never initialised (e.g. headless test env)
  it('destroys cleanly', async () => {
    const fixture = TestBed.createComponent(SectionCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(() => fixture.destroy()).not.toThrow();
  });
});

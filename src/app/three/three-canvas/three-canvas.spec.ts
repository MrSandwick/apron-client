import { TestBed } from '@angular/core/testing';
import { ThreeCanvas } from './three-canvas';

describe('ThreeCanvas', () => {
  // Component instantiates without throwing (WebGL init is guarded/browser-only)
  it('creates', async () => {
    TestBed.configureTestingModule({ imports: [ThreeCanvas] });
    const fixture = TestBed.createComponent(ThreeCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });

  // Renders the host container the renderer mounts its canvas into
  it('renders the host container', async () => {
    const fixture = TestBed.createComponent(ThreeCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('div');
    expect(host).toBeTruthy();
  });

  // Teardown is safe even when WebGL never initialised (e.g. headless test env)
  it('destroys cleanly', async () => {
    const fixture = TestBed.createComponent(ThreeCanvas);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(() => fixture.destroy()).not.toThrow();
  });
});

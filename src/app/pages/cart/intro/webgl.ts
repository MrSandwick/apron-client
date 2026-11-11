// The answer is the same for the whole session, so the probe context is created only once
let cached: boolean | undefined;

// Probes WebGL2 on a throwaway canvas: three.js needs it, and the real canvas
// cannot switch context type once it has been asked for one
export function webglAvailable(): boolean {
  if (cached !== undefined) return cached;
  cached = probe();
  return cached;
}

function probe(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    // Hand the probe context back right away
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// Forgets the cached answer, so a test can probe again with a different stub
export function resetWebglProbe(): void {
  cached = undefined;
}

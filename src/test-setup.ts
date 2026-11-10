// The test DOM has no matchMedia, which GSAP ScrollTrigger needs. This stub never matches, so
// motion-gated animations stay off in tests (the same result as a reduced-motion user)
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

import "@testing-library/jest-dom/vitest";

// jsdom does not implement window.matchMedia — stub it for all tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom does not implement canvas rendering — stub getContext so libraries
// that probe for canvas support at import time (e.g. plotly.js) do not emit
// "Not implemented: HTMLCanvasElement's getContext() method" noise.
type CanvasContext2D = Record<string, unknown>;
const canvasContext = (): CanvasContext2D =>
  new Proxy<CanvasContext2D>(
    {},
    {
      get(_target, prop) {
        if (prop === "canvas") return {};
        if (prop === "measureText") {
          return () => ({
            width: 0,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: 0,
          });
        }
        if (prop === "getImageData")
          return () => ({ data: [], width: 0, height: 0 });
        if (
          prop === "createLinearGradient" ||
          prop === "createRadialGradient"
        ) {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set() {
        return true;
      },
    },
  );

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  writable: true,
  value: (contextId: string) => (contextId === "2d" ? canvasContext() : null),
});

// ── Additional jsdom stubs for generator-driven suites ────────────────

// crypto.randomUUID — used by tracking.ts / templates.ts; jsdom may lack it
if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto ?? globalThis, "randomUUID", {
    writable: true,
    value: () => "00000000-0000-4000-a000-000000000000",
  });
}

// navigator.sendBeacon — used by tracking.ts / Analytics.ts; missing in jsdom
if (typeof navigator.sendBeacon !== "function") {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value: () => true,
  });
}

// ResizeObserver / IntersectionObserver — needed by ag-grid & monaco probes
if (typeof globalThis.ResizeObserver !== "function") {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof globalThis.IntersectionObserver !== "function") {
  (globalThis as Record<string, unknown>).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// scroll helpers — jsdom throws "Not implemented"
globalThis.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

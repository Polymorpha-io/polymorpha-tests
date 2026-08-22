/**
 * Mock factories for vi.mock / vi.fn — the one-call replacement for the
 * repeated `vi.mock('@/lib/stats/...')` blocks in CleaningPanel/AnalysePanel tests.
 *
 * Usage in a test file (module top-level — `vi.mock` calls are hoisted above
 * imports, so wrap the imported factory in a NEW arrow to defer evaluation):
 *
 *   import { cleaningPanelDeps } from "../../generators/mocks";
 *   vi.mock("@/lib/stats/descriptive", () => cleaningPanelDeps.descriptive());
 *   vi.mock("@/lib/stats/recommendations", () => cleaningPanelDeps.recommendations());
 *   vi.mock("@/lib/stats/api", () => cleaningPanelDeps.api());
 *   vi.mock("plotly.js", () => cleaningPanelDeps.plotly());
 *   vi.mock("react-plotly.js", () => cleaningPanelDeps.reactPlotly());
 */
import { vi } from "vitest";
import React from "react";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";

/** Factory shapes used by CleaningPanel-dependent component tests. */
export const cleaningPanelDeps = {
  descriptive: () => ({
    computeDescriptive: vi.fn().mockResolvedValue({}),
    computeFrequency: vi.fn().mockResolvedValue({}),
  }),
  recommendations: () => ({
    useRecommendations: () => ({
      recommendations: [],
      state: {},
      loading: false,
      error: null,
      offline: false,
    }),
  }),
  api: () => ({
    computeStats: vi.fn().mockResolvedValue({}),
    fetchStats: vi.fn().mockResolvedValue({}),
    callStatsApi: vi.fn().mockResolvedValue({}),
    callStatsApiWithPath: vi.fn().mockResolvedValue({}),
  }),
  plotly: () => ({ default: {} }),
  reactPlotly: () => ({
    default: () => React.createElement("div", null, "Plotly"),
  }),
};
/** Empty ComputedStats fixture shared by AnalysePanel tab tests. */
export function emptyComputedStats(): ComputedStats {
  return {
    descriptive: [],
    frequencies: [],
    correlation: null,
    normality: [],
    numericCols: [],
    catCols: [],
  };
}

export interface FetchMockOptions {
  status?: number;
  headers?: Record<string, string>;
  /** response body text — defaults to JSON of `body` */
  bodyText?: string;
}

/**
 * Install a fetch mock resolving to a JSON Response envelope
 * `{ result: <body> }` (the callStatsApi contract) or raw `body`.
 */
export function mockFetch(
  body: unknown,
  opts: FetchMockOptions & { envelope?: boolean } = {},
): ReturnType<typeof vi.fn> {
  const payload =
    opts.envelope !== false
      ? JSON.stringify({ result: body })
      : JSON.stringify(body);
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(opts.bodyText ?? payload, {
      status: opts.status ?? 200,
      headers: opts.headers,
    }),
  );
  return vi.mocked(globalThis.fetch);
}

/** Install a fetch mock that rejects (network error / timeout). */
export function mockFetchError(message: string): ReturnType<typeof vi.fn> {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError(message));
  return vi.mocked(globalThis.fetch);
}

/**
 * Factory for `vi.mock("@/config/firebase", firebaseConfigMock())`.
 * The auth user is mutable via `currentUser` so tests can simulate
 * signed-in vs signed-out. The factory is lazy, so closure state is safe.
 */
export function firebaseConfigMock() {
  const state: {
    currentUser: { getIdToken: () => Promise<string> } | null;
  } = {
    currentUser: { getIdToken: () => Promise.resolve("mock-token") },
  };
  return {
    getFirebaseAuth: () => ({ currentUser: state.currentUser }),
    getFirebaseDb: () => null,
    getFirebaseStorage: () => null,
    __setAuthUser: (u: typeof state.currentUser) => {
      state.currentUser = u;
    },
  };
}

/** Stub `navigator.sendBeacon` (missing in jsdom). Returns the mock fn. */
export function mockSendBeacon(): ReturnType<typeof vi.fn> {
  const beacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: beacon,
  });
  return beacon;
}

/** Stub browser APIs missing from jsdom (ResizeObserver, scroll). */
export function stubBrowserApis(): void {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!("IntersectionObserver" in globalThis)) {
    (globalThis as Record<string, unknown>).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  globalThis.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:mock");
}

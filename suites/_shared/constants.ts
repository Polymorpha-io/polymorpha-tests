/**
 * Test-infrastructure constants (single source, G33).
 * Ports, E2E timeouts, fixture names and test identities live here.
 * Production values (quotas, routes, storage shapes) are imported from
 * @polymorpha/business-logic / @polymorpha/stella — never redefined.
 */

// ─── Ports / hosts (mirror suites/polymorpha/vite.config.ts + playwright.config.ts) ───
export const PORTS = {
  /** Wrangler Pages + Worker (single local entry, T7). */
  worker: 8787,
  /** Python Cloud Functions. */
  python: 8080,
  /** Vite dev (playwright baseURL). */
  vite: 5173,
} as const;
export const HOSTS = {
  worker: `http://127.0.0.1:${PORTS.worker}`,
  python: `http://127.0.0.1:${PORTS.python}`,
  local: `http://localhost:${PORTS.vite}`,
} as const;

// ─── E2E timeouts (Playwright ms) ───
export const E2E_TIMEOUTS = {
  /** Modal/button appearance. */
  ui: 10_000,
  /** Auth redirect. */
  auth: 30_000,
  /** Parse + modeller render. */
  upload: 60_000,
  /** Full-suite per-test ceiling. */
  spec: 90_000,
  /** expect() default. */
  expect: 15_000,
  /** Short settle sleep. */
  sleepShort: 500,
  /** Medium settle sleep. */
  sleepMedium: 1_500,
  /** Long settle sleep. */
  sleepLong: 3_000,
} as const;

// ─── Fixture names (must match fixtures/*.csv + mocks/*.csv) ───
export const FIXTURE_NAMES = {
  minimal: "minimal",
  mixed: "mixed",
  missing: "missing",
  outliers: "outliers",
  datesAndText: "dates_and_text",
  anova: "anova",
  correlation: "correlation",
  skewed: "skewed",
  duplicates: "duplicates",
  dirty10k: "dirty_10k",
  large: "large",
  mannWhitney: "mann_whitney",
  singleRow: "single_row",
  unicode: "unicode",
} as const;
export type FixtureName =
  (typeof FIXTURE_NAMES)[keyof typeof FIXTURE_NAMES];

// ─── Test identities (test-only credentials/ids) ───
export const TEST_IDS = {
  e2eEmail: "polymorpha.e2e@example.com",
  e2ePassword: "E2ePass!2026",
  mockToken: "mock-token",
  uploadId: "test-upload",
  workspaceId: "test-workspace",
  blobMock: "blob:mock",
} as const;

// ─── Quota mirrors ───
// Assert against @polymorpha/business-logic values directly
// (e.g. `expect(MERGE_CROSS_CELL_LIMIT).toBe(500_000)`); never redefine here.

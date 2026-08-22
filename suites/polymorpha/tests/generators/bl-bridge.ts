/**
 * Business-logic bridge — re-exports the canonical Python generators' TS mirror
 * so app suites can `import { makeDataset } from "../../generators/bl-bridge"`
 * without duplicating. When the wheel is updated, this file stays in sync via
 * `npm update @polymorpha/business-logic`.
 *
 * For Python, the source of truth is `python/polymorpha/tests/generators/` in
 * the business-logic repo (installed at node_modules/@polymorpha/business-logic/python).
 * This TS file is a thin typed facade for Vitest suites that need the same
 * deterministic datasets.
 */

// Re-export everything from the app's generators — they are the TS source of truth
// and are kept in sync with the Python generators by the contract matrix.
export * from "./dataset";
export * from "./seed";
export * from "./matrix";
export * from "./stats";
export * from "./contract";

// Python-specific helpers that have no TS equivalent — exposed for documentation
// and for `vitest` workers that spawn Python via `callStatsApi` mocks.
// The actual Python implementation lives at:
//   node_modules/@polymorpha/business-logic/python/polymorpha/tests/generators/
// and is tested by `npm run test:backend` (337 tests).
export const BL_PYTHON_GENERATORS_PATH = "polymorpha/tests/generators";
export const BL_PYTHON_SEED_NOTE =
  "Python seed uses random.Random + numpy.random.Generator(PCG64) — same mulberry32 logic as TS seed.ts via hash_string";

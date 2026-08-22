/**
 * Test-generator barrel — the interconnecting structure all generated suites
 * import from. Generators are pure + deterministic and never appear as test
 * files themselves (no `.test.` suffix → outside vitest `include`).
 */
export * from "./seed";
export * from "./dataset";
export * from "./matrix";
export * from "./cleaning";
export * from "./store";
export * from "./mocks";
export * from "./stats";
export * from "./render";
export * from "./assertions";

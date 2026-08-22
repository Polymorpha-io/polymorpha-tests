# AGENTS.md — Polymorpha Tests (Central Test Registry)

> **Purpose:** Single source of truth for **all** test cases of the Polymorpha ecosystem (UI `vitest`/`playwright`, backend `pytest`, business-logic `pytest`). Both `Polymorpha-io/polymorpha` and `Polymorpha-io/polymorpha-business-logic` are decluttered — their tests live here.
> **Upstreams (GitHub-only):** `git+https://github.com/Polymorpha-io/polymorpha.git#main` , `git+https://github.com/Polymorpha-io/polymorpha-business-logic.git#main` (`python/` wheel `polymorpha`). **NEVER** reference `C:\Users\shawn\Desktop\polymorpha-business-logic` or any local filesystem path — use the GitHub-resolved package at `node_modules/@polymorpha/business-logic` per `G15`.
> **Last updated:** 2026-08-20

## Global Guardrail — G22 (applies to all 3 repos) — Central Test Registry Is Mandatory

`Polymorpha-io/polymorpha-tests` is the single source of truth for Polymorpha test cases (`git+https://github.com/Polymorpha-io/polymorpha-tests.git#main`).

For EVERY implementation plan, feature plan, refactor, migration, or bug fix that changes Polymorpha behavior:

1. Inspect `polymorpha-tests/suites/polymorpha/` for relevant existing tests before implementation.
2. Identify the affected central suites in the plan's verification section.
3. Reuse or extend tests in `polymorpha-tests`; do not create a permanent parallel test under `polymorpha/tests/`.
4. Execute the relevant central test suite through the central registry after implementation.
5. The plan MUST include a central-registry validation step, even when the change appears unrelated to tests.
6. If no existing test applies, explicitly state why and add a central test when the behavior is testable.
7. `polymorpha/tests/` is not a source of truth. It may contain only explicitly approved compatibility/transition tests such as `g10-strict-inventory.test.ts` during migration.
8. Never reference `C:\Users\*`, local sibling repositories, symlinks, or copied test directories as CI test dependencies. CI resolves the central Git repository only.
9. Central test synchronization MUST pass its freshness/hash check (`node scripts/sync.mjs --check`) before tests are considered authoritative.
10. Do not silently skip central tests because a local implementation test passes.

Required plan pattern: `implementation → identify central suite → sync/check polymorpha-tests → run relevant central tests → build → integration/E2E validation`. When a feature introduces a new artifact, API, data path, retrieval path, storage path, or cross-layer contract, the plan MUST state which central test suite owns that contract. This rule applies to all future Polymorpha plans, including Stella, Notebook, Knowledge, Embedding, Data Services, Pipeline, Cloud Functions, Workspace, UI, and infrastructure work.

**Before ANY test file is created or modified (`tests/**`, `**/*.test.*`, `**/*.spec.*`, `python/polymorpha/tests/**`, `suites/**`) the LLM MUST:**

1. `git ls-remote https://github.com/Polymorpha-io/polymorpha-tests.git HEAD` + `git ls-remote` for both upstreams to get `main` SHAs.
2. Search **3 remotes via GitHub, not local**: `raw.githubusercontent.com/Polymorpha-io/polymorpha-tests/main/**` , `raw.githubusercontent.com/Polymorpha-io/polymorpha/main/**` , `raw.githubusercontent.com/Polymorpha-io/polymorpha-business-logic/main/**` (budget ≤3 `grep`/`glob` `E5` `E9`). Also inspect this repo's `suites/` and `fixtures/` .
3. Reuse: `@polymorpha/business-logic` `RecommendationLaws`/`DataCleaner` `G15`, `tests/mocks/*.csv` + `tests/generators/dataset.ts` `G20` fixtures (`numeric_small` `<30`, `wide_categorical` `14→52` one-hot, `dirty` `null/mixed/high-cardinality`), existing `suites/` helpers. Do not duplicate per `D18` `G17` `G21`.
4. Run `node scripts/sync.mjs --check` (hash truth `G21`) before `npm run test:all` — sync is GitHub-only (`scripts/sync.mjs` fetches `raw.githubusercontent`, never `C:\Users\*`).
5. **Always push `polymorpha-tests` to `main` after any test suite change** — `git add` → `git commit` → `git push origin main` in `Polymorpha-io/polymorpha-tests` so CI and `polymorpha`'s `build` (which resolves `git+https://github.com/Polymorpha-io/polymorpha-tests.git#main`) always sees the latest. Do NOT leave test changes only locally or on a feature branch. After pushing, verify with `node scripts/sync.mjs --check` in `polymorpha` via `npm run test:central`.

> **Purpose:** Single source of truth for **all** test cases of the Polymorpha ecosystem (UI `vitest`/`playwright`, backend `pytest`, business-logic `pytest`). Both `Polymorpha-io/polymorpha` and `Polymorpha-io/polymorpha-business-logic` are decluttered — their tests live here. **Last updated:** `2026-08-23` — G22 mandatory push rule added per user request.

### Mandatory Future-Plan Contract

This registry is authoritative. Every subsequent Polymorpha implementation plan MUST inspect `suites/polymorpha/` before coding, map changed behavior to one or more central suites, extend the central suite rather than adding a permanent test under `polymorpha/tests`, run `node scripts/sync.mjs --check` before validation, run the relevant central tests, and include the central test result in the plan's verification evidence. A plan is incomplete if it validates only the application repository's local tests. `polymorpha`'s `npm run build` calls tests from GitHub as a library via `git+https://github.com/Polymorpha-io/polymorpha-tests.git#main` (local `npm --prefix` is dev convenience only).

## Strict Inventory — Dual Residence

`tests/unit/g10-strict-inventory.test.ts` (`P1-A G10`) **must exist in both**:
- `Polymorpha-io/polymorpha` `tests/unit/g10-strict-inventory.test.ts` (source of truth for `tsc -p tsconfig.app.json --showConfig` `strict:true` + top-3 `any` 0 — `C10` `D1` batch format)
- `Polymorpha-io/polymorpha-tests` `suites/polymorpha/unit/g10-strict-inventory.test.ts` (mirror, CI gate `ci.yml` fails if drift — `diff -u` SHA-tracked).

`npm run build` in `polymorpha` still runs `npx tsc -b --noEmit` (strict) but defers `vitest`/`pytest` to this repo (`polymorpha-tests` required status check). `G6` batch build + `G10` `any` justified per `D20` still enforced here (`D30` toolchain authority `prettier --check` `eslint` `tsc -b` `vitest` `pytest`).

## All Widgets Functional — 10 Sub-Units + Import Coverage

Every widget/component must have an E2E `T6` using `fixtures/*.csv`:
- Pipeline `01` `Upload→Preview→Clean→Analyse(Normality/Correlation/Tests/ML)→Export`, Workspace `02`, Auth `03`, Data Services `04`, Dictionary `05`, Stats `06`, Cloud-Functions `07`, Infra `08`, Analytics `09`, UI Primitives `10`.
- All important functionalities tested per `docs/architecture/0*.md` testing guardrails (use `concurrency>1 Promise.all` `G18` `ANON_MAX_ROWS=10k`).

## Execution

- `npm run sync` — GitHub-only mirror (`raw.githubusercontent` clones `tests/`, `vite.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `python/polymorpha/tests`).
- `npm run test:all` — `test:ui && test:api && test:e2e && test:python`.
- `npm run build` — `prebuild + tsc -b + vite build` (no vendored tests — `G6`).
- CI `/.github/workflows/ci.yml` — schedule `6h` + `on: push/PR` fans out `vitest` `playwright` `pytest`.

See `README.md` for provenance and `scripts/sync.mjs` for GitHub fetch implementation.

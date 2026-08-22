# AGENTS.md — Polymorpha Tests (Central Test Registry)

> **⚠️ DeepSeek Peak Pricing:** DeepSeek charges **2× during peak hours**
> (UTC 1:00–4:00 AM and 6:00–10:00 AM · UTC+8: 9 AM–12 noon and 2–6 PM).
> If current time is peak, **ask the user to verify** before starting any AI task.

> **Purpose:** Single source of truth for **all** test cases of the Polymorpha ecosystem — UI `vitest`/`playwright` E2E (11 sub-units inc. Stella 11, `T6` `concurrency>1`) + business-logic `ts` parity + `python/polymorpha/tests` 347 cases + `polymorpha-stella` `ts` parity + `python/polymorpha_stella` + `cloud-functions` G18. Upstreams `Polymorpha-io/polymorpha`, `Polymorpha-io/polymorpha-business-logic`, `Polymorpha-io/polymorpha-stella` are decluttered — their tests live here per `G22`. **GitHub-only, no local fallback** `G15`/`G15b` — `git+https://github.com/Polymorpha-io/{...}.git#main` → `node_modules/@polymorpha/{business-logic,stella}` + wheel, never `C:\Users\*`.
> **Upstreams (GitHub-only):** `git+https://github.com/Polymorpha-io/polymorpha.git#main`, `git+https://github.com/Polymorpha-io/polymorpha-business-logic.git#main` (`python/` wheel `polymorpha`), `git+https://github.com/Polymorpha-io/polymorpha-stella.git#main` (`ts` `knowledge` + `python/polymorpha_stella` `StellaRagProfiler`). **NEVER** reference `C:\Users\shawn\Desktop\...` or any local sibling as primary — `raw.githubusercontent` only.
> **Last updated:** 2026-08-23 · **Ticket prefix:** `POLY-`

---

## Repository Role — Verification Layer (Central Registry)

**This repo is the Verification Layer.** It owns every test that proves `polymorpha` (UI 11 sub-units), `polymorpha-business-logic` (Logic Layer), and `polymorpha-stella` (Stella Library `G25/G26`) work together. No upstream keeps a permanent parallel suite — they delegate here via `git+https`.

| Layer              | Repo                                         | Contract                                                                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Logic**          | `Polymorpha-io/polymorpha-business-logic`    | Owns domain logic (`DataCleaner`, `RecommendationLaws`, `hashDataset`, etc. `ts` + `python/polymorpha/{Stats,ML,Cleaner,IO}` wheel). Tests mirrored from `python/polymorpha/tests` (347 cases) into `suites/business-logic/python` via `scripts/sync.mjs` `G15` `git+https`.                     |
| **Stella Library** | `Polymorpha-io/polymorpha-stella`            | Owns Stella/RAG/embedder/knowledge/vector/representation/notebook `G15b` `G25/G26` `ts` + `python/polymorpha_stella` `StellaRagProfiler`. Tests `tests/unit` 19+4 its `TS` `KnowledgeExtractor` + `python/polymorpha_stella` mirrored into `suites/stella` via `scripts/sync.mjs` `G15b`.        |
| UI                 | `Polymorpha-io/polymorpha`                   | Owns React 19 + Zustand + Vite + Firebase/Workers 11 sub-units inc. Stella 11. Imports logic via `@polymorpha/business-logic` **and** `@polymorpha/stella` `git+https` per `G15`/`G15b`. `polymorpha/tests/` decluttered — only `g10-strict-inventory.test.ts` dual-resident `G22`.              |
| **Verification**   | `Polymorpha-io/polymorpha-tests` (this repo) | Owns `suites/polymorpha/{unit,api,e2e,mocks,generators}` + `suites/business-logic/python` + `suites/stella/{unit,e2e,python}` + `suites/cloud-functions` + `fixtures/*.csv` + `scripts/sync.mjs` (GitHub-only `raw.githubusercontent`, hash truth `G21`). All 11 sub-units `T6` `concurrency>1`. |

**Rule:** For EVERY implementation plan that changes behavior in `polymorpha`, `polymorpha-business-logic`, **or `polymorpha-stella`**, the plan MUST identify and execute against the relevant central suite _here_ (not a local `tests/` mirror) — `suites/polymorpha` **or** `suites/business-logic` **or** `suites/stella`. See `G22` below.

---

## Ecosystem — 4-Repo Interconnect (Source of Truth)

> **Canonical diagram lives in `Polymorpha-io/polymorpha` `AGENTS.md#ecosystem---4-repo-interconnect`** (`https://raw.githubusercontent.com/Polymorpha-io/polymorpha/main/AGENTS.md#ecosystem---4-repo-interconnect`). This file’s copy MUST stay identical — if drift, `polymorpha/AGENTS.md` wins (`diff -u`).

### Ecosystem Graph

```
                       ┌─────────────────────────────────┐
                       │  polymorpha-business-logic      │
                       │  Logic Layer (G15/G16)          │
                       │  ts/src/{core,stats,io,         │
                       │    exporters,dict,utils,        │
                       │    networking} + py/{Stats,ML,  │
                       │    Cleaner,IO,schemas,RagProf}  │
                       └──────────────┬──────────────────┘
                                      │ git+https://github.com/Polymorpha-io/polymorpha-business-logic.git#main
                                      │ TS: import { hashString } from '@polymorpha/business-logic'
                                      │ Py: from polymorpha.rag import RagProfiler
                                      ▼
                       ┌─────────────────────────────────┐
                       │  polymorpha-stella ★            │
                       │  Knowledge/Stella Library       │
                       │  (G15b/G16b, G25/G26)           │
                       │  ts/src/{knowledge,embeddings,  │
                       │    lib/vector,lib/representation│
                       │    lib/rag/pipelines,notebook,  │
                       │    stella/{brain,models}} +     │
                       │  py/polymorpha_stella/rag       │
                       └──────────────┬──────────────────┘
                                      │ git+https://github.com/Polymorpha-io/polymorpha-stella.git#main
                                      │ TS: import { KnowledgeService, BrainService } from '@polymorpha/stella'
                                      │ Py: from polymorpha_stella.rag import StellaRagProfiler
                                      ▼
                       ┌─────────────────────────────────┐
                       │  polymorpha                     │
                       │  UI Layer (G8)  11 sub-units    │
                       │  Pipeline 01→Workspace 02→Auth  │
                       │  03→Data Services 04→Dictionary │
                       │  05→Stats 06→Cloud Functions 07 │
                       │  →Infra 08→Analytics 09→UI Prim │
                       │  10→Stella/Knowledge 11         │
                       └──────────────┬──────────────────┘
                                      │ validated by
                                      ▼
                       ┌─────────────────────────────────┐
                       │  polymorpha-tests               │
                       │  Verification Layer (G22)       │
                       │  suites/polymorpha/{unit,api,   │
                       │    e2e,mocks,generators} +      │
                       │  suites/business-logic/python   │
                       │  (347) + suites/stella/{unit,   │
                       │    e2e,python} + fixtures       │
                       │  sync.mjs --check G21 hash      │
                       └─────────────────────────────────┘
```

### Cross-Repo Guardrail Quick-Ref

| Guardrail                     | This repo (Verification Layer)                                                                                                                                                                                                            | Business-logic                                                                                                                                                                                                              | Stella counterpart                                                                                                                                                                                    | Polymorpha (UI)                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G15** generic single source | Imports `business-logic` only via wheel/git `git+https` → `suites/business-logic/python`, never local sibling; reuse `RecommendationLaws`/`DataCleaner` per `G15` `D18`                                                                   | Same `G15` in `https://raw.githubusercontent.com/Polymorpha-io/polymorpha-business-logic/main/AGENTS.md` — before new helper/type, verify not in `ts/src`/`python/polymorpha`; **never imports `@polymorpha/stella`** `D21` | **Stella imports `business-logic`** `G15b` via `git+https` `hashString`/`DICTIONARY_TERMS`/`RagProfiler`, never vice-versa                                                                            | `git+https://github.com/Polymorpha-io/polymorpha-business-logic.git#main` → `node_modules/@polymorpha/business-logic`                                                                                                                                                               |
| **G15b** Stella single source | Stella unit canonical in `polymorpha-stella` `tests/unit`, mirrored via `UPSTREAMS` `Polymorpha-io/polymorpha-stella` `dest: suites/stella`                                                                                               | N/A — business-logic stays Stella-free                                                                                                                                                                                      | Same `G15b` in `https://raw.githubusercontent.com/Polymorpha-io/polymorpha-stella/main/AGENTS.md` — before new Stella/RAG/knowledge, verify not in `ts/src/knowledge\|embeddings\|lib/vector\|stella` | `git+https://github.com/Polymorpha-io/polymorpha-stella.git#main` → `node_modules/@polymorpha/stella`; before new Stella helper search `@polymorpha/stella` first                                                                                                                   |
| **G16** keep Wrangler in sync | `UPSTREAMS` `git ls-remote` fetch new SHAs via `git ls-remote`; `node scripts/sync.mjs` to pull (now 4 upstreams)                                                                                                                         | **Exception to G8:** direct `git push origin main` required (Wrangler fetches `main` at deploy)                                                                                                                             | **G16b Exception to G8:** direct `git push origin main` required for `stella`                                                                                                                         | After `business-logic` **or `stella`** push to `main`, run `npm update @polymorpha/{business-logic,stella}` + `npm run build`                                                                                                                                                       |
| **G22** central test registry | **Canonical** `implementation → identify central suite → sync/check → run relevant central tests → build → E2E` — required in every plan's **Verification** (now 4 SHAs: `polymorpha` + `business-logic` + `stella` + `polymorpha-tests`) | Same `G22` mirror — before ANY `python/polymorpha/tests/**` change, scan `polymorpha-tests#main` `raw.githubusercontent` + reuse `suites/` helpers                                                                          | Same `G22` mirror in stella — before ANY `ts/src/knowledge/**`/`tests/**` change, scan `polymorpha-tests#main` `raw.githubusercontent` + reuse `suites/` helpers                                      | `git+https://github.com/Polymorpha-io/polymorpha-tests.git#main` — before ANY `tests/**` change, scan **4** remotes via GitHub (`raw.githubusercontent`, ≤3 grep `E5`/`E9`), `polymorpha/tests/` only `g10-strict-inventory.test.ts` dual-resident; `node scripts/sync.mjs --check` |
| **G25/G26** single plane      | Verifies via `suites/stella/unit` + `suites/polymorpha/e2e/stella-knowledge.spec.ts` `T6` `BrainService → KnowledgeService.search()` only `KnowledgeRecord` boundary                                                                      | N/A                                                                                                                                                                                                                         | **Authoritative** `G25`/`G26` — all artifacts `→ KnowledgeRecord.kind → EmbeddingService → VectorStore` behind `KnowledgeService.search()`                                                            | `BrainService → KnowledgeService.search()` only; no `BrainService → UserLibrary/DatasetRepresentationService/VectorStore`                                                                                                                                                           |

**Branch & push summary:** This repo suite changes → `git push origin main` (`G22`), AGENTS docs via `feat/*` is fine locally. `polymorpha` → `feat/* → PR → main` (`G8`); `polymorpha-business-logic` → **direct `main`** (`G16`); `polymorpha-stella` → **direct `main`** (`G16b` library). See per-repo `AGENTS.md` for full rule text.

---

## Global Guardrail — G22 (applies to all 4 repos) — Central Test Registry Is Mandatory

`Polymorpha-io/polymorpha-tests` is the single source of truth for Polymorpha test cases (`git+https://github.com/Polymorpha-io/polymorpha-tests.git#main`).

For EVERY implementation plan, feature plan, refactor, migration, or bug fix that changes Polymorpha behavior:

1. Inspect `polymorpha-tests/suites/{polymorpha,business-logic,stella}/` for relevant existing tests before implementation.
2. Identify the affected central suites in the plan's verification section.
3. Reuse or extend tests in `polymorpha-tests`; do not create a permanent parallel test under `polymorpha/tests/` or `polymorpha-stella/tests/` alone — mirror via `UPSTREAMS`.
4. Execute the relevant central test suite through the central registry after implementation.
5. The plan MUST include a central-registry validation step, even when the change appears unrelated to tests.
6. If no existing test applies, explicitly state why and add a central test when the behavior is testable.
7. `polymorpha/tests/` is not a source of truth. It may contain only explicitly approved compatibility/transition tests such as `g10-strict-inventory.test.ts` during migration. `polymorpha-stella/tests/` canonical unit is mirrored via `UPSTREAMS`, not duplicated.
8. Never reference `C:\Users\*`, local sibling repositories, symlinks, or copied test directories as CI test dependencies. CI resolves the central Git repository only `G15` `G15b` — **GitHub-only, no `C:\Users\*` fallback** (user 2026-08-23 `fuck the local fallback`).
9. Central test synchronization MUST pass its freshness/hash check (`node scripts/sync.mjs --check` `G21` `UPSTREAMS` 4 SHAs) before tests are considered authoritative.
10. Do not silently skip central tests because a local implementation test passes.

Required plan pattern: `implementation → identify central suite → sync/check polymorpha-tests (4 upstreams) → run relevant central tests → build → integration/E2E validation`. When a feature introduces a new artifact, API, data path, retrieval path, storage path, or cross-layer contract, the plan MUST state which central test suite owns that contract. This rule applies to all future Polymorpha plans, including Stella, Notebook, Knowledge, Embedding, Data Services, Pipeline, Cloud Functions, Workspace, UI, and infrastructure work.

**Before ANY test file is created or modified (`tests/**`, `**/*.test.*`, `**/*.spec.*`, `python/polymorpha/tests/**`, `python/polymorpha_stella/**`, `suites/**`) the LLM MUST:**

1. `git ls-remote https://github.com/Polymorpha-io/polymorpha-tests.git HEAD` + `git ls-remote` for upstreams `polymorpha` + `business-logic` + `stella` to get `main` SHAs.
2. Search **4 remotes via GitHub, not local**: `raw.githubusercontent.com/Polymorpha-io/polymorpha-tests/main/**`, `/polymorpha/main/**`, `/polymorpha-business-logic/main/**`, `/polymorpha-stella/main/**` (budget ≤3 `grep`/`glob` `E5`/`E9`). Also inspect this repo's `suites/` and `fixtures/`.
3. Reuse: `@polymorpha/business-logic` `RecommendationLaws`/`DataCleaner` `G15`, `@polymorpha/stella` `KnowledgeService`/`BrainService` `G15b` `G25/G26`, `tests/mocks/*.csv` + `tests/generators/dataset.ts` `G20` fixtures (`numeric_small` `<30`, `wide_categorical` `14→52` one-hot, `dirty` `null/mixed/high-cardinality`), existing `suites/` helpers. Do not duplicate per `D18` `G17` `G21`.
4. Run `node scripts/sync.mjs --check` (hash truth `G21` `UPSTREAMS` 4 SHAs) before `npm run test:all` — sync is GitHub-only (`scripts/sync.mjs` fetches `raw.githubusercontent`, **no `C:\Users\*`**).
5. **Always push `polymorpha-tests` to `main` after any test suite change** — `git add` → `git commit` → `git push origin main` in `Polymorpha-io/polymorpha-tests` so CI and `polymorpha`'s `build` (which resolves `git+https://github.com/Polymorpha-io/polymorpha-tests.git#main`) always sees the latest.

### Mandatory Future-Plan Contract

This registry is authoritative. Every subsequent Polymorpha implementation plan MUST inspect `suites/{polymorpha,business-logic,stella}/` before coding, map changed behavior to one or more central suites, extend the central suite rather than adding a permanent test under `polymorpha/tests/` or `polymorpha-stella/tests/` alone, run `node scripts/sync.mjs --check` before validation, run the relevant central tests, and include the central test result in the plan's verification evidence. A plan is incomplete if it validates only the application repository's local tests.

---

## Coverage Matrix — What This Registry Must Verify (4-Repo)

> **All functions of `polymorpha` (UI 11 inc. Stella) + `polymorpha-business-logic` + `polymorpha-stella` are covered here. Gaps fail CI `T6` `concurrency>1`.

### A. Polymorpha UI Layer — 11 Sub-Units (fixtures/*.csv, T6 E2E `concurrency>1`, G18 quotas)

| #   | Sub-Unit         | Central suite                                                                                                                                                                                                                                 | Fixture(s)                                                          | Key capability verified                                                                                                                                                                                                   |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Pipeline         | `suites/polymorpha/e2e/pipeline.spec.ts`, `pipeline-smoke-no-loop.spec.ts`, `pipeline-cache.global.spec.ts`, `full-pipeline-ml.spec.ts` + `suites/polymorpha/unit/pipeline/*`                                                                 | `mixed.csv`, `minimal.csv`, `large.csv` (`ANON_MAX_ROWS=10k` slice) | 6-step flow `Upload→Model→Preview→Clean→Analyse→Export`, guest + workspace-embedded, `CacheService` T3 50MB LRU + `stepCacheHashes`/`hashDataset`                                                                         |
| 02  | Workspace        | `suites/polymorpha/e2e/workspace-open.spec.ts` + `suites/polymorpha/unit/workspace-*`                                                                                                                                                         | `minimal.csv`, `spotify_subset.csv`                                 | CRUD, datasets/exports/notes, `FirestoreService` workspace persistence, `storagePath` `users/{uid}` vs `anonymous/pending` isolation                                                                                      |
| 03  | Auth & User      | `suites/polymorpha/e2e/auth.setup.ts` + `suites/polymorpha/unit/auth/*`                                                                                                                                                                       | `minimal.csv`                                                       | Firebase Auth, `useAuthStore`, membership/Stripe gates                                                                                                                                                                    |
| 04  | Data Services    | `suites/polymorpha/unit/data-services/*`, `cleaning/*`, `sanitize*`, `CacheService*`                                                                                                                                                          | `missing.csv`, `duplicates.csv`, `outliers.csv`, `unicode.csv`      | `IO.Parser` via `@polymorpha/business-logic`, `CompressionStream`/`fflate`, `hashDataset`, `ANON_MAX_ROWS=10k`/`50MB` quota                                                                                               |
| 05  | Dictionary       | `suites/polymorpha/unit/dictionary/*` + `suites/polymorpha/e2e/stella-knowledge.spec.ts`                                                                                                                                                      | `anova.csv`, `correlation.csv`                                      | `terms.ts`/`enhanced_terms.json`, KaTeX rendering                                                                                                                                                                         |
| 06  | Stats & Export   | `suites/polymorpha/e2e/cleaning-panel.spec.ts`, `analyse-run.spec.ts`, `export.spec.ts` + `suites/polymorpha/unit/analyse/*`, `export/*`, `generated/*`                                                                                       | `anova.csv`, `mann_whitney.csv`, `correlation.csv`, `skewed.csv`    | `DataCleaner`/`RecommendationLaws` → stats (`descriptive`/`correlation`/`testsRunner`/`callStatsApi*`) → `pdf`/`docx`/`xlsx` via `rowMappers`, `cart`                                                                     |
| 07  | Cloud Functions  | `suites/cloud-functions/test_g18_cross_layer.py`, `test_storage_isolation.py`, `suites/polymorpha/api/*`                                                                                                                                      | `large.csv` 5000+ `LARGE_FILE_THRESHOLD`, `g18` concurrency         | Python `Stats`/`ML`/`Cleaner`/`IO` wheel (`polymorpha` from `node_modules/@polymorpha/business-logic/python`), `callCleanApi`/`callStatsApi*` `storagePath` fallback                                                      |
| 08  | Infrastructure   | `suites/polymorpha/e2e/pipeline-cache.global.spec.ts`, `no-react-error-185.spec.ts` + `suites/polymorpha/unit/infra/*`                                                                                                                        | `large.csv`, `single_row.csv`                                       | Wrangler `wrangler.jsonc`/`src/worker.ts`, `public/_headers` CSP, `vite.config.ts`, Firebase `firestore.rules`/`storage.rules`                                                                                            |
| 09  | Analytics        | `suites/polymorpha/unit/analytics/*`                                                                                                                                                                                                          | `minimal.csv`                                                       | Client/server tracking (`CacheService`/`WorkspaceService`)                                                                                                                                                                |
| 10  | UI Primitives    | `suites/polymorpha/e2e/*` + `suites/polymorpha/unit/ui/*`                                                                                                                                                                                     | —                                                                   | `useAccessibleDialog` C7, `ErrorBoundary`, theme, ag-grid, lucide-react                                                                                                                                                   |
| 11  | Stella/Knowledge | `suites/stella/unit/{knowledge/dataset-column,notebook/stella-notebook-pipeline}` (canonical `polymorpha-stella/tests/unit` mirrored) + `suites/polymorpha/e2e/stella-knowledge.spec.ts` `stella-rag.spec.ts` `notebook-stella-aware.spec.ts` | `missing.csv`, `minimal.csv` `G20` `concurrency>1`                  | `KnowledgeService.search()` `G25/G26` `KnowledgeRecord` 9 kinds `dataset_profile/column_semantic/data_representative/relationship/notebook_cell` `EmbeddingService` `VectorStore` `BrainService` `openai/gpt-oss-20b` SSE |

Every widget E2E uses `fixtures/*.csv` (unified from `polymorpha/tests/mocks/`) and `generators/dataset.ts` G20 fixtures via `suites/polymorpha/generators`.

### B. Business-Logic Layer — 4 Areas (TS + Python)

| Area                          | Logic module                                                                                                                                           | Central suite                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`                        | `DataCleaner`, `cleaning.ts`, `cleaningDerived.ts`, `RecommendationLaws`, `dataOps.ts`, `encoding.ts`, `MethodologyValidator`, `RenderSafetyValidator` | `suites/business-logic/python/polymorpha/tests/test_cleaner*` + `suites/polymorpha/unit/core/*` (`cleaning`, `recommendation`, `encoding`) via `ts` parity; `generators/cleaning.ts` helpers |
| `stats`                       | `testCatalog`, `testsTabDerived`, `formulaBuilder`, `interpretation`                                                                                   | `suites/business-logic/python/polymorpha/tests/test_stats*`, `test_catalog*` + `suites/polymorpha/unit/stats/*`, `api/generated/api-matrix.test.ts` (matrix over `STATS_ACTIONS` minRows)    |
| `io` + `networking` + `utils` | `typeDetector`, `identifier`, `workspaceState`, `payloadBuilders`, `hash`, `compress`                                                                  | `suites/business-logic/python/polymorpha/tests/test_io*`, `test_hash*`, `test_compress*` + `suites/polymorpha/unit/io/*`; `G15` forbids duplicate parser in `polymorpha`                     |
| `exporters` + `dictionary`    | `pdf`/`excel`/`docx`/`rowMappers`, `terms`/`enhanced_terms.json`                                                                                       | `suites/business-logic/python/polymorpha/tests/test_export*` + `suites/polymorpha/unit/export/*`, `dictionary/*`                                                                             |

### C. Stella Library — Knowledge/Stella (TS + Python)

| Area                                           | Logic module                                                                                                                                                              | Central suite                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `knowledge` `G25/G26`                          | `KnowledgeService` `KnowledgeStore` `KnowledgeExtractor` `providers/DatasetKnowledgeProvider` `providers/RelationshipKnowledgeProvider` `types` `KnowledgeRecord` 9 kinds | `suites/stella/unit/knowledge/dataset-column` (header-only 30-col no sentinel, `Stella/Knowledge 11`) + `suites/stella/unit/notebook/stella-notebook-pipeline` 19 its `TF 384-d bag+bigrams mock` `MemoryIDB` `activeCell+0.3 dataset+0.2` |
| `embeddings` `lib/vector` `lib/representation` | `EmbeddingService` `EmbeddingCache` 20MB/10k `VectorStore` `clientStore` `DatasetRepresentationService` `v1-head-tail-quantile-rare` `SampleCoverage`                     | `suites/stella/unit` same 19 its `vector` `IDB` `G18` `concurrency>1`                                                                                                                                                                      |
| `lib/rag` `notebook` `stella/brain`            | `pipelines.ts` 5 pipelines `RagService` `notebook/types` `nbformat` `NotebookContextBuilder` `BrainService` `Embedder` `embeddingModel` `@xenova/transformers` 384d       | `suites/stella/unit/notebook/stella-notebook-pipeline` + `suites/polymorpha/e2e/notebook-stella-aware.spec.ts` `T6`                                                                                                                        |
| `python/polymorpha_stella`                     | `rag/profiler.py` `StellaRagProfiler` thin `polymorpha.rag.RagProfiler` → `KnowledgeRecord`                                                                               | `suites/stella/python` `pytest` `StellaRagProfiler`                                                                                                                                                                                        |

**Counting truth (2026-08-23):** `suites/polymorpha/unit` 39 + `suites/polymorpha/api` 2 + `suites/polymorpha/e2e` 12 + `suites/business-logic/python` 17 suites (347 collected) + `suites/stella/unit` 2 (19+4 its) + `suites/cloud-functions` 3 = authoritative per `G21` `git ls-remote` SHAs in `.sync-sha.json` (now 4 SHAs: `polymorpha` + `business-logic` + `stella` + `polymorpha-tests`).

---

## Strict Inventory — Dual Residence

`tests/unit/g10-strict-inventory.test.ts` (`P1-A G10`) **must exist in both**:

- `Polymorpha-io/polymorpha` `tests/unit/g10-strict-inventory.test.ts` (source of truth for `tsc -p tsconfig.app.json --showConfig` `strict:true` + top-3 `any` 0 — `C10` `D1` batch format)
- `Polymorpha-io/polymorpha-tests` `suites/polymorpha/unit/g10-strict-inventory.test.ts` (mirror, CI gate `ci.yml` fails if drift — `diff -u` SHA-tracked).

`npm run build` in `polymorpha` still runs `npx tsc -b --noEmit` (strict) but defers `vitest`/`pytest` to this repo (`polymorpha-tests` required status check). `G6` batch build + `G10` `any` justified per `D20` still enforced here (`D30` toolchain authority `prettier --check` `eslint` `tsc -b` `vitest` `pytest`).

---

## All Widgets Functional — 11 Sub-Units + Import Coverage

Every widget/component must have an E2E `T6` using `fixtures/*.csv`:

- Pipeline `01` `Upload→Preview→Clean→Analyse(Normality/Correlation/Tests/ML)→Export`, Workspace `02`, Auth `03`, Data Services `04`, Dictionary `05`, Stats `06`, Cloud-Functions `07`, Infra `08`, Analytics `09`, UI Primitives `10`, **Stella/Knowledge `11`**.
- All important functionalities tested per `docs/architecture/0*.md` testing guardrails (use `concurrency>1 Promise.all` `G18` `ANON_MAX_ROWS=10k`) + `Stella` `G25/G26` `KnowledgeRecord` 9 kinds.

---

## Sync Contract — GitHub-only, Hash Truth G21 (No Local Fallback)

| Item             | Detail                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fetch source** | `raw.githubusercontent.com/Polymorpha-io/{polymorpha,polymorpha-business-logic,polymorpha-stella}/main/{tests, ts/src/knowledge, python/polymorpha_stella, vite.config.ts, playwright.config.ts, src/test/setup.ts, python/polymorpha/tests, cloud-functions/tests}` — **never `C:\Users\*`** (user 2026-08-23 `fuck the local fallback` `G15`/`G15b`)                               |
| **Script**       | `scripts/sync.mjs` (`UPSTREAMS` `repo`/`dest`/`paths` **GitHub-only, no `localFallback`**) — `node scripts/sync.mjs` (fetch + overwrite `suites/`), `node scripts/sync.mjs --check` (fail if SHA stale vs `.sync-sha.json` `G21`)                                                                                                                                                    |
| **SHA file**     | `.sync-sha.json` `{ "Polymorpha-io/polymorpha": "<sha>", "Polymorpha-io/polymorpha-business-logic": "<sha>", "Polymorpha-io/polymorpha-stella": "<sha>" }` via `git ls-remote https://github.com/<repo>.git HEAD` (`G21` hash truth, now 4 SHAs)                                                                                                                                     |
| **Destinations** | `polymorpha` → `suites/polymorpha` (`tests/unit`, `tests/api`, `tests/e2e`, `tests/mocks`→`fixtures`, `generators`, `src/test/setup.ts`, `vite.config.ts`) + `suites` (`cloud-functions/tests`); `business-logic` → `suites/business-logic` (`python/polymorpha/tests`, `pyproject.toml`); `stella` → `suites/stella` (`tests/unit`, `ts/src/knowledge`, `python/polymorpha_stella`) |
| **When to sync** | Before any `npm run test:all`, before `npm run build` if `polymorpha`/`business-logic`/`stella` `AGENTS.md` changed, and in every plan's `Verification` before running central tests (`G22`)                                                                                                                                                                                         |
| **Fail mode**    | **No fallback** — if `fetchRaw` 404 or `api.github.com` 503, `sync.mjs` throws `Error` with `Top-level keys` hint and exits 1 `G19` `catch // ignore` forbidden; do **not** silently use empty `rows=[]` or local `C:\Users\…` copy                                                                                                                                                  |

See `README.md` for provenance and `scripts/sync.mjs` for the `UPSTREAMS` definition (now 4 entries, `localFallback` removed).

---

## Execution

- `npm run sync` — GitHub-only mirror (`raw.githubusercontent` clones `tests/`, `vite.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `python/polymorpha/tests`, `ts/src/knowledge`, `python/polymorpha_stella`).
- `npm run test:all` — `test:ui && test:api && test:e2e && test:python && test:stella`.
- `npm run test:ui` — `vitest run --reporter=verbose` over `suites/polymorpha/unit` (+ `api`)
- `npm run test:api` — `vitest run --config vite.api.config.ts`
- `npm run test:e2e` — `playwright test` (needs `:8787` Wrangler, `:8080` Python per `T7`)
- `npm run test:python` — `python -m pytest suites/business-logic/python -v --tb=short` (wheel `polymorpha`)
- `npm run test:stella` — `python -m pytest suites/stella/python -v --tb=short` + `vitest run suites/stella/unit` (wheel `polymorpha_stella` + `KnowledgeService` `G25/G26`)
- `npm run build` — `tsc -b --noEmit` `G6` (no vendored tests — logic is `tsc` only here)
- CI `/.github/workflows/ci.yml` — `on: push/PR, schedule: 6h, workflow_dispatch` fans out `vitest` `playwright` `pytest` (business-logic 347 + stella); `g10` drift gate `diff -u` included.

See `README.md` for provenance and `scripts/sync.mjs` for GitHub fetch implementation.

---

## Cross-References (source of truth for guardrails G15/G15b/G16/G16b/G22/G25/G26)

- Logic layer detail: `https://raw.githubusercontent.com/Polymorpha-io/polymorpha-business-logic/main/AGENTS.md`
- Stella library detail: `https://raw.githubusercontent.com/Polymorpha-io/polymorpha-stella/main/AGENTS.md` (`G15b`/`G16b`/`G25`/`G26` authoritative for knowledge/embedding/vector)
- UI layer detail: `https://raw.githubusercontent.com/Polymorpha-io/polymorpha/main/AGENTS.md`
- This file’s `G22` 10-point contract is canonical for the Verification Layer; upstreams cite it via GitHub raw.

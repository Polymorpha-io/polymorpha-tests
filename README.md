# polymorpha-tests — Central Test Registry

> Single source of truth for **all** test cases: `polymorpha` UI (`vitest`/`playwright`) + backend (`pytest`) + `business-logic` (`pytest` 347 + `ts` parity via `tsc`). Upstreams are decluttered after migration.

## Upstreams (GitHub-only, never local)

- `Polymorpha-io/polymorpha#main` — `tests/unit` 38 + `tests/api` 2 + `tests/e2e` 10 + `tests/mocks` 16 + `generators`
- `Polymorpha-io/polymorpha-business-logic#main` — `python/polymorpha/tests` 17 + `generators` 7 (347 collected) — fetched as `git+https://github.com/Polymorpha-io/polymorpha-business-logic.git#subdirectory=python` wheel `polymorpha` per `G15`.
- This repo — `GH: Polymorpha-io/polymorpha-tests#main` (served from `C:\Users\shawn\Desktop\polymorpha-tests` locally, but CI resolves `git+https`).

## Quick Start

```powershell
npm ci                      # installs @polymorpha/business-logic via git+https
npm run sync                # GitHub-only mirror: raw.githubusercontent -> suites/
npm run test:all            # vitest + playwright + pytest
npm run build               # tsc -b + vite build (G6 batch, G10 strict)
```

## Sync — Hash Truth (G21)

`node scripts/sync.mjs` fetches `raw.githubusercontent.com/Polymorpha-io/{polymorpha,polymorpha-business-logic}/main/{tests,vite.config.ts,playwright.config.ts,src/test/setup.ts,python/polymorpha/tests}` into `suites/` and logs `git ls-remote` SHAs. `--check` fails if stale. No `C:\Users\*` paths.

## Strict Inventory Dual Residence

`g10-strict-inventory.test.ts` lives in **both** `polymorpha/tests/unit/` and `suites/polymorpha/unit/` — CI diff fails on drift. See `AGENTS.md:G22`.

## Structure

```
suites/
  polymorpha/ { unit, api, e2e, mocks, generators, src/test }
  business-logic/python/ { polymorpha/tests, generators }
  cloud-functions/ { tests }
fixtures/        # unified CSVs from tests/mocks
scripts/sync.mjs # GitHub fetch
.github/workflows/ci.yml
AGENTS.md        # G22 scan-before-test rule
```

## CI

`.github/workflows/ci.yml` — `on: push/PR, schedule: 6h, workflow_dispatch` — clones both upstreams shallow, runs `npx vitest run` `npx playwright test` `python -m pytest`.

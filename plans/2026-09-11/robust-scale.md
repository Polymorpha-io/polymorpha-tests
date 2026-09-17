# Robust + Scale — tests leg (2026-09-11)

Parent: `polymorpha/plans/2026-09-11/robust-scale.md`.
Affected Repos: [business-logic ☐ stella ☐ polymorpha ☐ tests ☑] + Reason:
sync reliability without touching GitHub-only/no-fallback contract (G22.8).

## Done this leg

- `scripts/sync.mjs`: `fetchGithub()` wrapper with bounded retry (3 tries,
  exp backoff 500ms) on 429/408/425/5xx + network throws. 4xx (excl. retryable)
  still throws/skips exactly as before; no cache, no local fallback.
- `node --check scripts/sync.mjs` OK.

## Deferred

- `test:all` sharding, `vite.config` include dedupe, top-level playwright
  config, `__pycache__/test-results` noise ignore — need owner ack (CI-adjacent).

## Verification

- Syntax OK. Live `--check` needs network + SHAs — run before next central suite.
- No contract change → no new central tests; owners unchanged
  (`suites/polymorpha|business-logic|stella`).

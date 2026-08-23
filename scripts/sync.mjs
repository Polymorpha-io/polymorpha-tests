#!/usr/bin/env node
/**
 * sync.mjs — GitHub-only mirror for polymorpha-tests (no local fallback)
 *
 * Fetches tests and harnesses from GitHub, never from C:\Users\... (G15/G15b/G22).
 * GitHub-only: uses raw.githubusercontent.com + GitHub API; fails fast if GitHub unavailable (G19).
 * Sources:
 *  - Polymorpha-io/polymorpha#main             -> tests/, vite.config.ts, playwright.config.ts, src/test/setup.ts, src, cloud-functions/tests
 *  - Polymorpha-io/polymorpha-business-logic#main -> python/polymorpha/tests, python/pyproject.toml
 *  - Polymorpha-io/polymorpha-stella#main      -> tests/unit, ts/src/knowledge, python/polymorpha_stella (G15b library)
 *
 * Usage: node scripts/sync.mjs       (fetch + overwrite suites/)
 *        node scripts/sync.mjs --check (fail if SHA stale vs last sync — G21 hash truth)
 */

import { execSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_FILE = join(ROOT, ".sync-sha.json");

// GitHub-only upstreams — no localFallback (user 2026-08-23: fuck the local fallback G15/G15b)
const UPSTREAMS = [
  {
    repo: "Polymorpha-io/polymorpha",
    dest: "suites/polymorpha",
    paths: [
      "tests/unit",
      "tests/api",
      "tests/e2e",
      "tests/mocks",
      "tests/generators",
      "tests/tsconfig.json",
      "src/test/setup.ts",
      "src",
      "vite.config.ts",
      "playwright.config.ts",
      "package.json",
    ],
  },
  {
    repo: "Polymorpha-io/polymorpha-business-logic",
    dest: "suites/business-logic",
    paths: [
      "python/polymorpha/tests",
      "python/pyproject.toml",
      "python/Makefile",
    ],
  },
  {
    repo: "Polymorpha-io/polymorpha-stella",
    dest: "suites/stella",
    paths: [
      "tests/unit",
      "ts/src/knowledge",
      "ts/src/embeddings",
      "ts/src/lib/vector",
      "ts/src/lib/representation",
      "ts/src/lib/rag",
      "ts/src/notebook",
      "python/polymorpha_stella",
      "python/pyproject.toml",
    ],
  },
  {
    repo: "Polymorpha-io/polymorpha",
    dest: "suites",
    paths: [
      "cloud-functions/tests/test_storage_isolation.py",
      "cloud-functions/tests/test_g18_cross_layer.py",
      "cloud-functions/stats/tests/test_legacy_contract.py",
    ],
  },
];

function lsRemote(repo) {
  try {
    const out = execSync(`git ls-remote https://github.com/${repo}.git HEAD`, {
      encoding: "utf-8",
    });
    return out.split("\t")[0].trim();
  } catch {
    return "unknown";
  }
}

function githubHeaders() {
  const h = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "polymorpha-tests-sync",
  };
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GH_PAT ||
    "";
  if (token) h.Authorization = `token ${token}`;
  return h;
}

async function fetchRaw(repo, filePath) {
  const branch = "main";
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

async function listGithubFiles(repo, sha, prefix) {
  const apiUrl = `https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`;
  const res = await fetch(apiUrl, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`list ${repo} ${prefix}: HTTP ${res.status}`);
  const data = await res.json();
  const files = (data.tree || [])
    .filter((n) => n.type === "blob" && n.path.startsWith(prefix + "/"))
    .map((n) => n.path);
  const exact = (data.tree || []).find(
    (n) => n.type === "blob" && n.path === prefix,
  );
  if (exact) files.unshift(exact.path);
  return files;
}

function ensureDirForFile(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

async function syncUpstream(upstream, shas) {
  const sha = shas[upstream.repo];
  console.log(
    `[sync] ${upstream.repo} -> ${upstream.dest} (sha ${sha?.slice(0, 7)})`,
  );
  for (const p of upstream.paths) {
    const isFileHint = p.includes(".") && !p.endsWith("/");
    let files = null;
    if (sha && sha !== "unknown") {
      try {
        files = await listGithubFiles(upstream.repo, sha, p);
      } catch (e) {
        // GitHub-only — fail fast, no local fallback (G19)
        throw new Error(
          `[sync] list failed ${upstream.repo} ${p}: ${e.message} — GitHub-only, no local fallback`,
        );
      }
    }
    if (!files || files.length === 0) {
      if (isFileHint) files = [p];
      else {
        console.warn(`[sync]   skip ${p}: no files via GitHub API`);
        continue;
      }
    }
    for (const filePath of files) {
      let content;
      try {
        content = await fetchRaw(upstream.repo, filePath);
      } catch (e) {
        if (String(e.message).includes("404")) {
          console.warn(`[sync]   skip missing ${upstream.repo} ${filePath}: ${e.message}`);
          continue;
        }
        throw new Error(
          `[sync] fetch failed ${upstream.repo} ${filePath}: ${e.message} — GitHub-only`,
        );
      }
      const destPath = join(ROOT, upstream.dest, filePath);
      ensureDirForFile(destPath);
      writeFileSync(destPath, content);
      console.log(
        `[sync]   fetched ${filePath} -> ${relative(ROOT, destPath)} (${content.length} bytes)`,
      );
    }
  }
}

async function syncFixtures() {
  const srcDir = join(ROOT, "suites/polymorpha/tests/mocks");
  const dstDir = join(ROOT, "fixtures");
  if (!existsSync(srcDir)) {
    console.warn(`[sync] fixtures: src ${srcDir} missing, skipping`);
    return;
  }
  mkdirSync(dstDir, { recursive: true });
  const files = readdirSync(srcDir);
  for (const f of files) {
    if (f.endsWith(".csv")) {
      copyFileSync(join(srcDir, f), join(dstDir, f));
      console.log(`[sync] fixture ${f} -> fixtures/${f}`);
    }
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const shas = {};
  for (const u of UPSTREAMS) {
    if (!shas[u.repo]) shas[u.repo] = lsRemote(u.repo);
  }
  console.log("[sync] SHAs:", shas);

  if (check) {
    if (!existsSync(SHA_FILE)) {
      console.error(
        "[sync] --check: no .sync-sha.json, run without --check first",
      );
      process.exit(1);
    }
    const prev = JSON.parse(readFileSync(SHA_FILE, "utf-8"));
    const stale = Object.keys(shas).filter((k) => shas[k] !== prev[k]);
    if (stale.length) {
      console.error(
        `[sync] stale upstreams: ${stale.join(", ")} — run npm run sync`,
      );
      console.error(`[sync] prev:`, prev);
      console.error(`[sync] curr:`, shas);
      process.exit(1);
    }
    console.log("[sync] up to date");
    return;
  }

  for (const u of UPSTREAMS) mkdirSync(join(ROOT, u.dest), { recursive: true });
  mkdirSync(join(ROOT, "fixtures"), { recursive: true });
  mkdirSync(join(ROOT, ".github/workflows"), { recursive: true });

  const seen = new Set();
  for (const u of UPSTREAMS) {
    const key = `${u.repo}:${u.dest}:${u.paths.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncUpstream(u, shas);
  }

  await syncFixtures();

  writeFileSync(SHA_FILE, JSON.stringify(shas, null, 2) + "\n");
  console.log(`[sync] wrote ${SHA_FILE}`);
  console.log(
    "[sync] done — suites/ now mirrors GitHub (GitHub-only, no local fallback)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

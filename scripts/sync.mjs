#!/usr/bin/env node
/**
 * sync.mjs — GitHub-only mirror for polymorpha-tests
 *
 * Fetches tests and harnesses from GitHub, never from C:\Users\... as primary (G15/G22).
 * Local fallback is ONLY for offline migration bootstrap and logs a warning.
 * Sources:
 *  - Polymorpha-io/polymorpha#main        -> tests/, vite.config.ts, playwright.config.ts, src/test/setup.ts
 *  - Polymorpha-io/polymorpha-business-logic#main -> python/polymorpha/tests, python/pyproject.toml (reference)
 *
 * Usage: node scripts/sync.mjs       (fetch + overwrite suites/)
 *        node scripts/sync.mjs --check (fail if SHA stale vs last sync)
 */

import { execSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_FILE = join(ROOT, ".sync-sha.json");

// GitHub-only upstreams (dest is relative to ROOT)
// For polymorpha, dest = suites/polymorpha and filePath is preserved (tests/unit/foo.ts -> suites/polymorpha/tests/unit/foo.ts)
// For business-logic, dest = suites/business-logic (filePath python/... -> suites/business-logic/python/...)
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
    localFallback: "C:/Users/shawn/polymorpha",
  },
  {
    repo: "Polymorpha-io/polymorpha-business-logic",
    dest: "suites/business-logic",
    paths: [
      "python/polymorpha/tests",
      "python/pyproject.toml",
      "python/Makefile",
    ],
    localFallback: "C:/Users/shawn/polymorpha/node_modules/@polymorpha/business-logic",
  },
  {
    repo: "Polymorpha-io/polymorpha",
    dest: "suites",
    paths: [
      "cloud-functions/tests/test_storage_isolation.py",
      "cloud-functions/tests/test_g18_cross_layer.py",
      "cloud-functions/stats/tests/test_legacy_contract.py",
    ],
    localFallback: "C:/Users/shawn/polymorpha",
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

async function fetchRaw(repo, filePath) {
  const branch = "main";
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    console.warn(`[sync] fetch failed ${url}: ${e.message} — trying local fallback if present`);
    return null;
  }
}

async function listGithubFiles(repo, sha, prefix) {
  // prefix is like "tests/unit" — list all files under that prefix via GitHub API
  // Use git/trees recursive
  const apiUrl = `https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`;
  try {
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "polymorpha-tests-sync" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const files = (data.tree || [])
      .filter((n) => n.type === "blob" && n.path.startsWith(prefix + "/"))
      .map((n) => n.path);
    // also handle exact file match (when prefix itself is a file)
    const exact = (data.tree || []).find((n) => n.type === "blob" && n.path === prefix);
    if (exact) files.unshift(exact.path);
    return files;
  } catch (e) {
    console.warn(`[sync] list API failed ${repo} ${prefix}: ${e.message}`);
    return null;
  }
}

function listLocalFiles(localRoot, prefix) {
  const full = join(localRoot, prefix);
  if (!existsSync(full)) return [];
  const st = statSync(full);
  if (st.isFile()) return [prefix];
  // directory: walk recursively
  const out = [];
  function walk(dir) {
    const entries = readdirSync(dir);
    for (const ent of entries) {
      const p = join(dir, ent);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (s.isFile()) {
        const rel = relative(localRoot, p).replace(/\\/g, "/");
        out.push(rel);
      }
    }
  }
  walk(full);
  return out;
}

function ensureDirForFile(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

async function syncUpstream(upstream, shas) {
  const sha = shas[upstream.repo];
  console.log(`[sync] ${upstream.repo} -> ${upstream.dest} (sha ${sha?.slice(0, 7)})`);
  for (const p of upstream.paths) {
    const isFileHint = p.includes(".") && !p.endsWith("/"); // crude: has extension
    // Try GitHub API listing first
    let files = null;
    if (sha && sha !== "unknown") {
      files = await listGithubFiles(upstream.repo, sha, p);
    }
    if (!files || files.length === 0) {
      // Fallback to local enumeration + direct raw fetch per file, or pure local copy if raw fails
      const localFiles = listLocalFiles(upstream.localFallback, p);
      if (localFiles.length > 0) {
        files = localFiles;
        console.log(`[sync]   ${p}: using ${files.length} files from local vendor (GitHub list empty)`);
      } else if (isFileHint) {
        files = [p];
      } else {
        console.warn(`[sync]   skip ${p}: no files found via GitHub or local`);
        continue;
      }
    }
    for (const filePath of files) {
      // GitHub primary
      let content = await fetchRaw(upstream.repo, filePath);
      const destPath = join(ROOT, upstream.dest, filePath);
      // If fetch failed and local fallback exists, copy local
      if (content === null) {
        const localSrc = join(upstream.localFallback, filePath);
        if (existsSync(localSrc)) {
          ensureDirForFile(destPath);
          copyFileSync(localSrc, destPath);
          console.log(`[sync]   fallback copy ${filePath} -> ${relative(ROOT, destPath)}`);
          continue;
        } else {
          console.warn(`[sync]   missing ${filePath} (no GitHub, no local)`);
          continue;
        }
      }
      ensureDirForFile(destPath);
      writeFileSync(destPath, content);
      console.log(`[sync]   fetched ${filePath} -> ${relative(ROOT, destPath)} (${content.length} bytes)`);
    }
  }
}

async function syncFixtures() {
  // Unified fixtures: copy suites/polymorpha/tests/mocks -> fixtures/
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
      console.error("[sync] --check: no .sync-sha.json, run without --check first");
      process.exit(1);
    }
    const prev = JSON.parse(readFileSync(SHA_FILE, "utf-8"));
    const stale = Object.keys(shas).filter((k) => shas[k] !== prev[k]);
    if (stale.length) {
      console.error(`[sync] stale upstreams: ${stale.join(", ")} — run npm run sync`);
      console.error(`[sync] prev:`, prev);
      console.error(`[sync] curr:`, shas);
      process.exit(1);
    }
    console.log("[sync] up to date");
    return;
  }

  // Ensure dest dirs
  for (const u of UPSTREAMS) mkdirSync(join(ROOT, u.dest), { recursive: true });
  mkdirSync(join(ROOT, "fixtures"), { recursive: true });
  mkdirSync(join(ROOT, ".github/workflows"), { recursive: true });

  // De-duplicate upstream repos: group by repo+dest+paths unique
  const seen = new Set();
  for (const u of UPSTREAMS) {
    const key = `${u.repo}:${u.dest}:${u.paths.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // eslint-disable-next-line no-await-in-loop
    await syncUpstream(u, shas);
  }

  await syncFixtures();

  // Also ensure suites/polymorpha/src/test/setup.ts is present for vitest
  // Already handled via UPSTREAMS, but ensure parent exists

  writeFileSync(SHA_FILE, JSON.stringify(shas, null, 2) + "\n");
  console.log(`[sync] wrote ${SHA_FILE}`);
  console.log("[sync] done — suites/ now mirrors GitHub (with local fallback where needed)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

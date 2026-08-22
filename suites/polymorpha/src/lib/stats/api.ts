import { ref, getDownloadURL } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "@/config/firebase";
import { sanitizeStatsError, canonicalAction } from "@/lib/errors/sanitize";

async function getDownloadUrlForPath(storagePath: string): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Firebase Storage not initialized");
  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch {
    throw new Error(`Failed to generate download URL for: ${storagePath}`);
  }
}

const RAW_STATS_API_URL = import.meta.env.VITE_STATS_API_URL as
  string | undefined;
const RAW_STATS_TIMEOUT_MS = Number(
  import.meta.env.VITE_STATS_TIMEOUT_MS ?? "180000",
);
const STATS_TIMEOUT_MS =
  Number.isFinite(RAW_STATS_TIMEOUT_MS) && RAW_STATS_TIMEOUT_MS >= 5_000
    ? RAW_STATS_TIMEOUT_MS
    : 180_000;
const DEFAULT_STATS_API_URL = "/api/v1/stats";

const PARSE_API_URL = "/api/v1/parse";
const CLEAN_API_URL = "/api/v1/clean";
const EXECUTE_API_URL = "/api/v1/execute";

const ACTION_TIMEOUTS: Record<string, number> = {
  computeAll: 300_000,
  correlation: 180_000,
  regression: 120_000,
  ragProfile: 30_000,
};

/** Default timeout for parse/clean/execute calls (no VITE override). */
const REQUEST_TIMEOUT_MS = 180_000;

const STATS_API_URL: string = (() => {
  const url = RAW_STATS_API_URL?.trim();
  if (!url) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Stats API] VITE_STATS_API_URL is missing; falling back to /api/v1/stats.",
      );
    }
    return DEFAULT_STATS_API_URL;
  }

  // Allow same-origin paths in development (e.g. /stats via Vite proxy).
  if (url.startsWith("/")) {
    return url;
  }

  if (!/^https?:\/\//.test(url)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Stats API] VITE_STATS_API_URL is invalid; falling back to /api/v1/stats.",
      );
    }
    return DEFAULT_STATS_API_URL;
  }

  return url;
})();

// Centralized action registry

export const STATS_ACTIONS = {
  computeAll: { minRows: 1, label: "Compute all" },
  ragProfile: { minRows: 1, label: "RAG profile" },
  descriptive: { minRows: 2, label: "Descriptive statistics" },
  frequency: { minRows: 1, label: "Frequency table" },
  correlation: { minRows: 3, label: "Correlation matrix" },
  normality: { minRows: 3, label: "Normality test" },
  ttest: { minRows: 3, label: "t-test" },
  anova: { minRows: 6, label: "One-way ANOVA" },
  welchAnova: { minRows: 6, label: "Welch's ANOVA" },
  levene: { minRows: 4, label: "Levene's test" },
  regression: { minRows: 5, label: "OLS Regression" },
  vif: { minRows: 5, label: "VIF" },
  mannWhitney: { minRows: 4, label: "Mann-Whitney U" },
  kruskalWallis: { minRows: 6, label: "Kruskal-Wallis" },
  chiSquare: { minRows: 4, label: "Chi-square" },
  fisherExact: { minRows: 4, label: "Fisher's Exact" },
  wilcoxon: { minRows: 4, label: "Wilcoxon Signed-Rank" },
  pairCorrelation: { minRows: 3, label: "Pair correlation" },
  groupValues: { minRows: 1, label: "Group values" },
  insight: { minRows: 0, label: "Auto-insight" },
  recommendations: { minRows: 0, label: "Recommendations" },
  cleaningStats: { minRows: 2, label: "Cleaning stats" },
  rankColumns: { minRows: 2, label: "Rank columns" },
  detectIdentifierColumns: { minRows: 3, label: "Detect identifiers" },
  kendallTau: { minRows: 3, label: "Kendall's Tau" },
  // Equivalence & categorical (filtered)
  tost: { minRows: 4, label: "TOST Equivalence" },
  tostMean: { minRows: 4, label: "TOST Mean" },
  binomial: { minRows: 4, label: "Binomial Test" },
  mcnemar: { minRows: 4, label: "McNemar" },
  gofChisquare: { minRows: 4, label: "GOF Chi-square" },
  // ANOVA extended
  twoWayAnova: { minRows: 6, label: "Two-way ANOVA" },
  repeatedAnova: { minRows: 6, label: "Repeated Measures ANOVA" },
  friedman: { minRows: 6, label: "Friedman" },
  // Correlation extended
  partialCorrelation: { minRows: 4, label: "Partial Correlation" },
  pointBiserial: { minRows: 4, label: "Point-biserial" },
  // Regression extended (filtered)
  logisticRegression: { minRows: 6, label: "Logistic Regression" },
  ridgeRegression: { minRows: 6, label: "Ridge Regression" },
  lassoRegression: { minRows: 6, label: "Lasso Regression" },
  moderation: { minRows: 6, label: "Moderation" },
  mediation: { minRows: 6, label: "Mediation" },
} as const;

export type StatsAction = keyof typeof STATS_ACTIONS;

// Canonicalize aliased actions before any lookup — mirrors backend _ACTION_ALIASES
function resolveAction(action: string): string {
  return canonicalAction(action);
}

// Input validation

function validateInput(
  action: string,
  rows: Array<Record<string, unknown>>,
  params: Record<string, unknown>,
): void {
  if (!action) throw new Error("Stats API: action is required.");

  const canonical = resolveAction(action);
  const meta = STATS_ACTIONS[canonical as StatsAction];
  if (!meta) throw new Error(`Stats API: unknown action "${action}".`);

  const minRows = meta.minRows;
  if (minRows > 0) {
    if (!Array.isArray(rows) || rows.length < minRows) {
      throw new Error(
        `${meta.label} requires at least ${minRows} rows (got ${rows?.length ?? 0}).`,
      );
    }
  }

  // Validate column references exist in the data
  if (rows.length > 0) {
    const availableCols = new Set(Object.keys(rows[0]));
    const columnKeys = [
      "column",
      "column1",
      "column2",
      "numericCol",
      "groupCol",
      "dependentVar",
      "factor",
      "responseVar",
    ];
    for (const key of columnKeys) {
      const col = params[key];
      if (typeof col === "string" && col.trim() === "") {
        throw new Error(`Stats API: parameter "${key}" cannot be empty.`);
      }
      if (typeof col === "string" && col && !availableCols.has(col)) {
        throw new Error(
          `Column "${col}" not found in dataset. Available: ${[...availableCols].slice(0, 10).join(", ")}${availableCols.size > 10 ? "..." : ""}`,
        );
      }
    }
    // Validate array column references (predictors, columns)
    const arrayKeys = ["predictors", "columns"];
    for (const key of arrayKeys) {
      const arr = params[key];
      if (Array.isArray(arr)) {
        for (const col of arr) {
          if (typeof col === "string" && col.trim() === "") {
            throw new Error(
              `Stats API: parameter "${key}" contains an empty column name.`,
            );
          }
          if (typeof col === "string" && !availableCols.has(col)) {
            throw new Error(`Column "${col}" not found in dataset.`);
          }
        }
      }
    }
  }
}

// Output validation

function validatePValue(result: Record<string, unknown>, action: string): void {
  const pVal = result.pValue;
  if (pVal === undefined) return;
  if (typeof pVal !== "number" || !isFinite(pVal)) {
    throw new Error(`${action}: API returned invalid p-value (${pVal}).`);
  }
  if (pVal < 0 || pVal > 1) {
    throw new Error(`${action}: p-value out of range [0, 1] (got ${pVal}).`);
  }
}

/** Statistic keys that some deployments may only report under the generic `statistic` name. */
const STAT_ALIAS_KEYS = new Set(["U", "H", "F", "t", "W", "chiSq"]);

/** Assert that `obj` contains all `keys` as defined (non-undefined) properties. */
function requireFields(
  obj: Record<string, unknown>,
  keys: string[],
  action: string,
): void {
  for (const key of keys) {
    const present = key in obj && obj[key] !== undefined;
    const aliased =
      STAT_ALIAS_KEYS.has(key) &&
      "statistic" in obj &&
      obj.statistic !== undefined;
    if (!present && !aliased) {
      throw new Error(
        `${action}: missing required field "${key}" in response.`,
      );
    }
  }
}

function validateOutput(action: string, result: unknown): void {
  if (result === null || result === undefined) {
    throw new Error(`${action}: API returned empty result.`);
  }

  // Generic checks for object results
  if (typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    validatePValue(obj, action);
    // Validate that test statistics are finite numbers where expected
    const statKeys = ["t", "F", "U", "H", "chiSq", "statistic", "W"];
    for (const key of statKeys) {
      if (
        key in obj &&
        typeof obj[key] === "number" &&
        !isFinite(obj[key] as number)
      ) {
        throw new Error(
          `${action}: test statistic "${key}" is not finite (${obj[key]}).`,
        );
      }
    }
    // Validate correlation coefficient range
    if ("r" in obj && typeof obj.r === "number") {
      if (obj.r < -1 || obj.r > 1) {
        throw new Error(
          `${action}: correlation coefficient r out of range [-1, 1] (got ${obj.r}).`,
        );
      }
    }
    // Validate R-squared range
    if ("rSquared" in obj && typeof obj.rSquared === "number") {
      if (obj.rSquared < 0 || obj.rSquared > 1) {
        throw new Error(
          `${action}: R² out of range [0, 1] (got ${obj.rSquared}).`,
        );
      }
    }
    // Validate Cramér's V range
    if ("cramersV" in obj && typeof obj.cramersV === "number") {
      if (obj.cramersV < 0 || obj.cramersV > 1) {
        throw new Error(
          `${action}: Cramér's V out of range [0, 1] (got ${obj.cramersV}).`,
        );
      }
    }
  }

  // Action-specific schema guards
  switch (action) {
    case "correlation": {
      const matrix = result as { columns?: string[]; values?: number[][] };
      if (!matrix.columns || !matrix.values) {
        throw new Error(
          "correlation: malformed matrix (missing columns or values).",
        );
      }
      if (matrix.columns.length !== matrix.values.length) {
        throw new Error(
          `correlation: matrix shape mismatch — ${matrix.columns.length} columns but ${matrix.values.length} rows.`,
        );
      }
      for (const row of matrix.values) {
        if (!Array.isArray(row) || row.length !== matrix.columns.length) {
          throw new Error("correlation: non-square row in matrix.");
        }
      }
      break;
    }
    case "pairCorrelation": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["r", "pValue", "c1", "c2"], action);
      break;
    }
    case "ttest": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["t", "pValue", "df", "significant", "type"], action);
      break;
    }
    case "anova":
    case "welchAnova": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["F", "pValue", "significant"], action);
      break;
    }
    case "regression": {
      const obj = result as Record<string, unknown>;
      requireFields(
        obj,
        ["rSquared", "intercept", "coefficients", "fPValue"],
        action,
      );
      if (
        typeof obj.coefficients !== "object" ||
        obj.coefficients === null ||
        Array.isArray(obj.coefficients)
      ) {
        throw new Error(
          "regression: coefficients must be an object mapping predictor names to values.",
        );
      }
      break;
    }
    case "vif": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["vif", "flagged"], action);
      if (
        typeof obj.vif !== "object" ||
        obj.vif === null ||
        Array.isArray(obj.vif)
      ) {
        throw new Error(
          "vif: vif field must be an object mapping column names to VIF values.",
        );
      }
      if (!Array.isArray(obj.flagged)) {
        throw new Error("vif: flagged field must be an array.");
      }
      break;
    }
    case "mannWhitney": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["U", "pValue", "significant"], action);
      break;
    }
    case "kruskalWallis": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["H", "pValue", "df", "significant"], action);
      break;
    }
    case "chiSquare": {
      const obj = result as Record<string, unknown>;
      requireFields(
        obj,
        ["chiSq", "pValue", "df", "cramersV", "significant"],
        action,
      );
      break;
    }
    case "fisherExact": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "oddsRatio", "significant"], action);
      break;
    }
    case "levene": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "significant", "equalVariances"], action);
      break;
    }
    case "wilcoxon": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "statistic", "significant"], action);
      break;
    }
    case "normality": {
      if (Array.isArray(result)) {
        for (const item of result as Array<Record<string, unknown>>) {
          requireFields(item, ["column", "isNormal", "test", "pValue"], action);
        }
        break;
      }
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["column", "isNormal", "test", "pValue"], action);
      break;
    }
    case "descriptive": {
      if (Array.isArray(result)) {
        for (const item of result as Array<Record<string, unknown>>) {
          requireFields(item, ["column", "mean", "std"], action);
        }
        break;
      }
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["column", "mean", "std"], action);
      break;
    }
    case "kendallTau": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["tau", "pValue"], action);
      if (typeof obj.tau === "number" && (obj.tau < -1 || obj.tau > 1)) {
        throw new Error(
          `${action}: Kendall's tau out of range [-1, 1] (got ${obj.tau}).`,
        );
      }
      break;
    }
    case "tost":
    case "tostMean":
    case "tostProportion": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "significant"], action);
      break;
    }
    case "binomial": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "significant", "n"], action);
      break;
    }
    case "mcnemar": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "significant"], action);
      break;
    }
    case "gofChisquare": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["df", "pValue", "column"], action);
      break;
    }
    case "twoWayAnova": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["factor_a", "factor_b", "interaction"], action);
      break;
    }
    case "repeatedAnova":
    case "friedman": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["pValue", "significant"], action);
      break;
    }
    case "partialCorrelation": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["r", "pValue"], action);
      break;
    }
    case "pointBiserial": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["r", "pValue"], action);
      break;
    }
    case "logisticRegression": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["auc", "coefficients"], action);
      break;
    }
    case "ridgeRegression":
    case "lassoRegression": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["coefficients"], action);
      break;
    }
    case "moderation": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["interaction_p", "significant"], action);
      break;
    }
    case "mediation": {
      const obj = result as Record<string, unknown>;
      requireFields(obj, ["indirect"], action);
      break;
    }
  }
}

// Safe JSON parsing (handles NaN which Python's json.dumps may produce)
// Transparent gunzip: Worker `maybeGzipJson` gzips >1KB JSON. Some proxies / CF edge
// strip `Content-Encoding: gzip`, so `res.text()` would yield binary. Detect gzip
// magic `1f 8b` and decompress via `DecompressionStream` (or `fflate` fallback).

async function readResponseText(res: Response): Promise<string> {
  // Prefer arrayBuffer for gzip-magic detection; fallback to text for test mocks
  // that only implement `text()` / `json()` (jsdom/vitest).
  let buffer: ArrayBuffer | null = null;
  const canArrayBuffer =
    typeof (res as unknown as { arrayBuffer?: unknown }).arrayBuffer ===
    "function";
  if (canArrayBuffer) {
    try {
      // Clone first so a fallback `text()` is still possible if arrayBuffer throws
      const src: Response =
        typeof (res as unknown as { clone?: unknown }).clone === "function"
          ? (res as unknown as { clone: () => Response }).clone()
          : res;
      buffer = await (src as Response).arrayBuffer();
    } catch {
      buffer = null;
    }
  }
  if (buffer === null) {
    try {
      return await res.text();
    } catch {
      return "";
    }
  }
  if (buffer.byteLength === 0) return "";
  const bytes = new Uint8Array(buffer);
  const isGzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzipped) {
    return new TextDecoder().decode(buffer);
  }
  // Try native DecompressionStream first (zero dep, streaming)
  try {
    if (typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("gzip");
      const decompressed = new Blob([buffer]).stream().pipeThrough(ds);
      const out = await new Response(decompressed).arrayBuffer();
      return new TextDecoder().decode(out);
    }
  } catch {
    // fall through to fflate
  }
  try {
    const { gunzip } = await import("fflate");
    const decompressed = await new Promise<Uint8Array>((resolve, reject) => {
      gunzip(bytes, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    return new TextDecoder().decode(decompressed);
  } catch {
    // If gunzip fails, return raw decoded (will trigger JSON parse error with preview)
    return new TextDecoder().decode(buffer);
  }
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await readResponseText(res);
  try {
    return JSON.parse(text.replace(/\bNaN\b/g, "null"));
  } catch {
    // Non-JSON response (e.g. HTML error page from upstream) —
    // return a structured error so callers get a readable message.
    const preview = text.slice(0, 200).replace(/\s+/g, " ").trim();
    return {
      error: `Server returned non-JSON response (status ${res.status}). First 200 chars: ${preview || "(empty body)"}`,
    };
  }
}

// API call

/**
 * Get a Firebase ID token. By default reuses the cached token — stale tokens
 * are caught by the 401-retry path in postJson(). Pass force=true only on retry.
 */
async function getAuthToken(force = false): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;
    return await auth.currentUser.getIdToken(force);
  } catch {
    return null;
  }
}

/**
 * Shared POST helper for all backend endpoints: attaches auth, enforces a
 * timeout, and retries once with a force-refreshed token on 401 (stale token).
 */
async function postJson(
  url: string,
  body: Record<string, unknown>,
  opts: { timeoutMs?: number; label?: string; signal?: AbortSignal } = {},
): Promise<Response> {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    label = "API",
    signal: externalSignal,
  } = opts as {
    timeoutMs?: number;
    label?: string;
    signal?: AbortSignal;
  };

  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else
        externalSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
    }
    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if ((externalSignal as AbortSignal | undefined)?.aborted) throw err;
        throw new Error(
          `${label} timed out after ${Math.round(timeoutMs / 1000)}s.`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  const token = await getAuthToken();
  let res: Response;
  try {
    res = await doFetch(token);
  } catch (err) {
    // Retry once for transient network failures (e.g., localhost IPv6 vs 127.0.0.1)
    if (
      err instanceof TypeError &&
      (err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError"))
    ) {
      try {
        await new Promise((r) => setTimeout(r, 400));
        res = await doFetch(token);
      } catch (retryErr) {
        const message =
          retryErr instanceof Error
            ? retryErr.message
            : "Unknown network error";
        throw new Error(
          `${label} network error: ${message} (url: ${url}). Is the Python backend running on :8080? Try: .\\dev.ps1`,
        );
      }
      if (res!.status === 401 && token) {
        const fresh = await getAuthToken(true);
        if (fresh && fresh !== token) {
          try {
            res = await doFetch(fresh);
          } catch (retryAuthErr) {
            const message =
              retryAuthErr instanceof Error
                ? retryAuthErr.message
                : "Unknown network error";
            throw new Error(`${label} network error: ${message} (url: ${url})`);
          }
        }
      }
      return res!;
    }
    const message =
      err instanceof Error ? err.message : "Unknown network error";
    throw new Error(
      `${label} network error: ${message} (url: ${url}). Is the Python backend running on :8080? Try: .\\dev.ps1`,
    );
  }

  if (res.status === 401 && token) {
    // Stale ID token — force-refresh once and retry
    const fresh = await getAuthToken(true);
    if (fresh && fresh !== token) {
      try {
        res = await doFetch(fresh);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown network error";
        throw new Error(
          `${label} network error: ${message} (url: ${url}, backend: ${STATS_API_URL}). Is the Python backend running on :8080? Try: .\\dev.ps1`,
        );
      }
    }
  }
  return res;
}

export async function callStatsApi<T = unknown>(
  action: string,
  rows: Array<Record<string, unknown>>,
  params: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Promise<T> {
  const canonical = resolveAction(action);
  try {
    validateInput(canonical, rows, params);
  } catch (e) {
    throw new Error(
      sanitizeStatsError(e instanceof Error ? e.message : String(e)),
    );
  }

  const actionTimeout = ACTION_TIMEOUTS[canonical] ?? STATS_TIMEOUT_MS;
  const res = await postJson(
    STATS_API_URL,
    { action: canonical, rows, params, ...extra },
    { timeoutMs: actionTimeout, label: `Stats API "${canonical}"` },
  );

  const data = await parseJsonResponse(res);

  if (!res.ok) {
    const errorMsg =
      ((data as Record<string, unknown>)?.error as string) ||
      `Stats API error: ${res.status}`;
    throw new Error(sanitizeStatsError(errorMsg));
  }

  // Handle standard response envelope: { result, error, metadata }
  if (
    data &&
    typeof data === "object" &&
    "result" in (data as Record<string, unknown>)
  ) {
    const d = data as Record<string, unknown>;
    if (d.error) throw new Error(sanitizeStatsError(d.error as string));
    const result = d.result as T;
    validateOutput(canonical, result);
    return result;
  }

  // Legacy fallback (no envelope)
  const d = data as Record<string, unknown>;
  if (d.error) throw new Error(sanitizeStatsError(d.error as string));
  validateOutput(canonical, d.result ?? data);
  return (d.result ?? data) as T;
}

/** Per-session download-URL cache — TTL 45m (signed URL 1h, refresh before 15m) + inflight dedup */
const downloadUrlCache = new Map<string, { url: string; ts: number }>();
const DOWNLOAD_URL_TTL_MS = 45 * 60 * 1000;
const inflightDownloadUrl = new Map<string, Promise<string>>();

async function getDownloadUrlCached(storagePath: string): Promise<string> {
  const hit = downloadUrlCache.get(storagePath);
  if (hit && Date.now() - hit.ts < DOWNLOAD_URL_TTL_MS) return hit.url;
  const inflight = inflightDownloadUrl.get(storagePath);
  if (inflight) return inflight;
  const promise = getDownloadUrlForPath(storagePath)
    .then((url) => {
      downloadUrlCache.set(storagePath, { url, ts: Date.now() });
      inflightDownloadUrl.delete(storagePath);
      return url;
    })
    .catch((err) => {
      inflightDownloadUrl.delete(storagePath);
      throw err;
    });
  inflightDownloadUrl.set(storagePath, promise);
  return promise;
}

/**
 * Call stats API with storagePath instead of sending all rows in the body.
 * Python fetches data from Storage, optionally applies cleaning, then computes stats.
 */
export async function callStatsApiWithPath<T = unknown>(
  action: string,
  storagePath: string,
  cleaningConfig: Record<string, unknown> | null,
  params: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Promise<T> {
  const canonical = resolveAction(action);
  const actionTimeout = ACTION_TIMEOUTS[canonical] ?? STATS_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    action: canonical,
    storagePath,
    params,
    ...extra,
  };
  if (cleaningConfig) {
    body.cleaningConfig = cleaningConfig;
  }
  // The backend parser downloads the file via this signed URL.
  body.downloadUrl = await getDownloadUrlCached(storagePath);

  const res = await postJson(STATS_API_URL, body, {
    timeoutMs: actionTimeout,
    label: `Stats API "${canonical}"`,
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const errorMsg =
      ((data as Record<string, unknown>)?.error as string) ||
      `Stats API error: ${res.status}`;
    throw new Error(sanitizeStatsError(errorMsg));
  }

  if (
    data &&
    typeof data === "object" &&
    "result" in (data as Record<string, unknown>)
  ) {
    const d = data as Record<string, unknown>;
    if (d.error) throw new Error(sanitizeStatsError(d.error as string));
    const result = d.result as T;
    validateOutput(canonical, result);
    return result;
  }

  const d = data as Record<string, unknown>;
  if (d.error) throw new Error(sanitizeStatsError(d.error as string));
  validateOutput(canonical, d.result ?? data);
  return (d.result ?? data) as T;
}

export interface ComputeAllResult {
  descriptive: import("@/types").DescriptiveStats[];
  frequencies: import("@/types").FrequencyTable[];
  correlation: import("@/types").CorrelationMatrix | null;
  normality: import("@/types").NormalityResult[];
}

export async function callComputeAll(
  args: {
    rows?: Array<Record<string, unknown>>;
    numericCols: string[];
    catCols: string[];
    storageBacked?: import("./storageBacked").StorageBackedRef | null;
    cleaningConfig?: Record<string, unknown> | null;
  },
  extra: Record<string, unknown> = {},
): Promise<ComputeAllResult> {
  const { rows, numericCols, catCols, storageBacked, cleaningConfig } = args;
  if (storageBacked) {
    // Use storage-backed path to avoid shipping rows
    return await callStatsApiWithPath<ComputeAllResult>(
      "computeAll",
      storageBacked.storagePath,
      cleaningConfig ?? null,
      {},
      {
        numericCols,
        catCols,
        contentHash: storageBacked.contentHash,
        ...extra,
      },
    );
  }
  if (!rows || rows.length === 0) {
    throw new Error("computeAll requires rows or storageBacked");
  }
  return await callStatsApi<ComputeAllResult>(
    "computeAll",
    rows,
    {},
    {
      numericCols,
      catCols,
      ...extra,
    },
  );
}

// Parse API

export interface ParseApiResult {
  headers: string[];
  rows: Record<string, unknown>[];
  columnTypes: Array<{ name: string; type: string; detectedType: string }>;
  rowCount: number;
  colCount: number;
  fileName: string;
}

export async function callParseApi(
  storagePath: string,
  maxRows?: number,
  sourceUrlOrOpts?:
    string | { signal?: AbortSignal; sourceUrl?: string; contentHash?: string },
  contentHash?: string,
  signal?: AbortSignal,
): Promise<ParseApiResult> {
  const body: Record<string, unknown> = { storagePath };
  if (maxRows !== undefined) body.maxRows = maxRows;
  // Handle flexible opts: third arg may be opts object with signal
  let srcUrl: string | undefined;
  let hash: string | undefined;
  let sig: AbortSignal | undefined = signal;
  if (typeof sourceUrlOrOpts === "object" && sourceUrlOrOpts !== null) {
    srcUrl = sourceUrlOrOpts.sourceUrl;
    hash = sourceUrlOrOpts.contentHash;
    sig = sourceUrlOrOpts.signal ?? sig;
  } else {
    srcUrl = sourceUrlOrOpts as string | undefined;
    hash = contentHash;
  }
  if (srcUrl !== undefined) body.sourceUrl = srcUrl;
  if (hash !== undefined) body.contentHash = hash;

  const downloadUrl = await getDownloadUrlForPath(storagePath);
  body.downloadUrl = downloadUrl;

  const res = await postJson(PARSE_API_URL, body, {
    label: "Parse API",
    signal: sig,
  } as never);

  const data = (await parseJsonResponse(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      sanitizeStatsError(
        (data?.error as string) || `Parse API error: ${res.status}`,
      ),
    );
  }
  if (data.error) throw new Error(sanitizeStatsError(data.error as string));
  return data.result as ParseApiResult;
}

// Clean API

export interface CleanApiResult {
  rows: Record<string, unknown>[];
  diff: Record<string, unknown>;
  columns: Array<{ name: string; type: string; detectedType: string }>;
}

export async function callCleanApi(
  storagePath: string,
  cleaningConfig: Record<string, unknown>,
  columns: Array<{ name: string; type: string; detectedType: string }>,
  preview?: boolean,
  maxRows?: number,
  contentHash?: string,
): Promise<CleanApiResult> {
  const body: Record<string, unknown> = {
    storagePath,
    cleaningConfig,
    columns,
  };
  if (preview !== undefined) body.preview = preview;
  if (maxRows !== undefined) body.maxRows = maxRows;
  if (contentHash !== undefined) body.contentHash = contentHash;

  const downloadUrl = await getDownloadUrlForPath(storagePath);
  body.downloadUrl = downloadUrl;

  const res = await postJson(CLEAN_API_URL, body, { label: "Clean API" });

  const data = (await parseJsonResponse(res)) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      sanitizeStatsError(
        (data?.error as string) || `Clean API error: ${res.status}`,
      ),
    );
  }
  if (data.error) throw new Error(sanitizeStatsError(data.error as string));
  return data.result as CleanApiResult;
}

// Execute API (Code Editor workspace Run button)

export interface ExecuteDatasetRef {
  uploadId: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  workspaceId: string;
  workspaceName: string;
}

export interface ExecuteApiResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  resultRows?: Record<string, unknown>[];
  error?: string;
}

export async function callExecuteApi(params: {
  language: string;
  code: string;
  datasets: ExecuteDatasetRef[];
}): Promise<ExecuteApiResult> {
  const res = await postJson(
    EXECUTE_API_URL,
    params as unknown as Record<string, unknown>,
    { label: "Execute API" },
  );

  const text = await readResponseText(res);
  if (!text || !text.trim()) {
    throw new Error(
      `Execute API returned empty response (status ${res.status})`,
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text.replace(/\bNaN\b/g, "null")) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error(
      `Execute API returned invalid JSON (status ${res.status}, length ${text.length}): ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok) {
    throw new Error(
      sanitizeStatsError(
        (data?.error as string) || `Execute API error: ${res.status}`,
      ),
    );
  }
  if (data.error) throw new Error(sanitizeStatsError(data.error as string));
  return data.result as ExecuteApiResult;
}

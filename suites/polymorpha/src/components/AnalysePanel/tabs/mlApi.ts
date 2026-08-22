/**
 * mlApi — ML service endpoint resolution + training request.
 */
import type { Dataset } from "@/types";
import { getFirebaseAuth } from "@/config/firebase";
import { sanitizeStatsError } from "@/lib/errors/sanitize";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasProp(obj: UnknownRecord, key: string): boolean {
  return key in obj;
}

export interface TrainResult {
  status: string;
  algorithm: string;
  task: string;
  target: string;
  features: string[];
  trainSize: number;
  testSize: number;
  metrics: {
    train: Record<string, number>;
    test: Record<string, number | number[][] | string[]>;
    crossValidation?: {
      folds: number;
      scores: number[];
      mean: number;
      std: number;
      scoring: string;
    } | null;
  };
  featureImportance: { feature: string; importance: number }[] | null;
  hyperparams: Record<string, unknown>;
  predictions: {
    testActual: number[];
    testPredicted: number[];
  };
  warnings?: string[];
  error?: string;
}

export interface TrainParams {
  rows: Dataset["rows"];
  columns: { name: string; type: string }[];
  algorithm: string;
  target: string;
  features: string[];
  task: string;
  testSize: number;
  hyperparams: Record<string, unknown>;
  storagePath?: string;
  totalRowCount?: number;
  cleaningConfig?: unknown;
}

const RAW_STATS_API_URL = import.meta.env.VITE_STATS_API_URL as
  string | undefined;

const ML_ENDPOINT = (() => {
  const statsUrl = RAW_STATS_API_URL?.trim();

  if (!statsUrl) {
    return "/api/v1/machine-learning";
  }

  if (statsUrl.startsWith("/")) {
    const base = statsUrl.replace(/\/stats\/?$/, "").replace(/\/+$/, "");
    return `${base}/machine-learning`;
  }

  try {
    const url = new URL(statsUrl);
    const base = url.pathname.replace(/\/stats\/?$/, "").replace(/\/+$/, "");
    url.pathname = `${base}/machine-learning`;
    return url.toString();
  } catch {
    return "/api/v1/machine-learning";
  }
})();

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // anonymous fallback
  }
  return {};
}

function normalizeTrainResult(raw: unknown): TrainResult {
  if (!isRecord(raw)) return raw as unknown as TrainResult;
  // Surface backend error envelope as error field
  if (raw["error"] && !raw["metrics"]) {
    // keep error as-is, but ensure shape
    return raw as unknown as TrainResult;
  }
  const out: UnknownRecord = { ...raw };
  // Map nTrain/nTest -> trainSize/testSize (keep both for compat)
  out["trainSize"] = raw["trainSize"] ?? raw["nTrain"] ?? raw["n_train"] ?? 0;
  out["testSize"] = raw["testSize"] ?? raw["nTest"] ?? raw["n_test"] ?? 0;
  // Map flat metrics -> nested train/test (backend uses trainAccuracy, testAccuracy, trainR2, etc.)
  const rawMetrics = raw["metrics"];
  if (isRecord(rawMetrics)) {
    const m: UnknownRecord = rawMetrics;
    const hasFlat =
      hasProp(m, "trainAccuracy") ||
      hasProp(m, "testAccuracy") ||
      hasProp(m, "trainR2") ||
      hasProp(m, "testR2");
    if (hasFlat) {
      const train: Record<string, number> = {};
      const test: UnknownRecord = {};
      const trainAccuracy = m["trainAccuracy"];
      if (trainAccuracy != null) {
        const testAccuracy = m["testAccuracy"];
        train["accuracy"] =
          typeof trainAccuracy === "number"
            ? trainAccuracy
            : Number(trainAccuracy);
        test["accuracy"] =
          typeof testAccuracy === "number"
            ? testAccuracy
            : Number(testAccuracy);
      }
      const trainF1 = m["trainF1"];
      if (trainF1 != null) {
        const testF1 = m["testF1"];
        train["f1"] = typeof trainF1 === "number" ? trainF1 : Number(trainF1);
        test["f1"] = typeof testF1 === "number" ? testF1 : Number(testF1);
      }
      const trainR2 = m["trainR2"];
      if (trainR2 != null) {
        const testR2 = m["testR2"];
        train["r2"] = typeof trainR2 === "number" ? trainR2 : Number(trainR2);
        test["r2"] = typeof testR2 === "number" ? testR2 : Number(testR2);
      }
      const trainMAE = m["trainMAE"];
      if (trainMAE != null) {
        const testMAE = m["testMAE"];
        train["mae"] =
          typeof trainMAE === "number" ? trainMAE : Number(trainMAE);
        test["mae"] = typeof testMAE === "number" ? testMAE : Number(testMAE);
      }
      const trainRMSE = m["trainRMSE"];
      if (trainRMSE != null) {
        const testRMSE = m["testRMSE"];
        train["rmse"] =
          typeof trainRMSE === "number" ? trainRMSE : Number(trainRMSE);
        test["rmse"] =
          typeof testRMSE === "number" ? testRMSE : Number(testRMSE);
      }
      // precision/recall derived from classificationReport if missing
      const precisionVal = m["precision"];
      if (typeof precisionVal === "number") test["precision"] = precisionVal;
      const recallVal = m["recall"];
      if (typeof recallVal === "number") test["recall"] = recallVal;
      // confusionMatrix, classNames, classificationReport pass through
      const confusionMatrix = m["confusionMatrix"];
      if (confusionMatrix) test["confusionMatrix"] = confusionMatrix;
      const classNames = m["classNames"];
      if (classNames) test["classNames"] = classNames;
      const classificationReport = m["classificationReport"];
      if (classificationReport) {
        // derive precision/recall/f1 if not already set
        try {
          if (isRecord(classificationReport)) {
            const report: UnknownRecord = classificationReport;
            const weighted = report["weighted avg"] ?? report["weighted_avg"];
            if (isRecord(weighted)) {
              const weightedPrecision = weighted["precision"];
              if (
                typeof weightedPrecision === "number" &&
                test["precision"] === undefined
              )
                test["precision"] = weightedPrecision;
              const weightedRecall = weighted["recall"];
              if (
                typeof weightedRecall === "number" &&
                test["recall"] === undefined
              )
                test["recall"] = weightedRecall;
            }
          }
        } catch {
          void 0;
        }
      }
      // preserve crossValidation
      const metrics: UnknownRecord = { train, test };
      const crossValidation = m["crossValidation"];
      if (crossValidation) metrics["crossValidation"] = crossValidation;
      // carry through any other test keys (accuracy, precision etc already)
      const scores = m["scores"];
      if (Array.isArray(scores)) metrics["scores"] = scores;
      out["metrics"] = metrics as TrainResult["metrics"];
      // ensure top-level metrics.train/test exist for MlResults
      const outMetrics = out["metrics"] as UnknownRecord;
      if (isRecord(outMetrics)) {
        if (!outMetrics["train"]) outMetrics["train"] = train;
        if (!outMetrics["test"]) outMetrics["test"] = test;
      }
    } else if (!m["train"] || !m["test"]) {
      // already nested but ensure shape
      if (!m["train"] && !m["test"] && typeof m["accuracy"] === "number") {
        out["metrics"] = { train: {}, test: m } as TrainResult["metrics"];
      }
    }
  }
  // Predictions: backend may return predictions at top level or inside metrics; normalize
  if (!out["predictions"]) {
    const rawPredictions = raw["predictions"];
    if (rawPredictions) out["predictions"] = rawPredictions;
    else out["predictions"] = { testActual: [], testPredicted: [] };
  }
  // Feature importance: already correct shape
  // Ensure hyperparams echoes user hyperparams + server _hp
  if (!out["hyperparams"]) out["hyperparams"] = {};
  return out as unknown as TrainResult;
}

async function readResponseText(res: Response): Promise<string> {
  let buffer: ArrayBuffer | null = null;
  const canArrayBuffer =
    typeof (res as unknown as { arrayBuffer?: unknown }).arrayBuffer ===
    "function";
  if (canArrayBuffer) {
    try {
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
    return new TextDecoder().decode(buffer);
  }
}

export async function trainModel(params: TrainParams): Promise<TrainResult> {
  const body: Record<string, unknown> = {
    action: "train",
    columns: params.columns,
    cleaningDiff: {},
    statsResults: {},
    params: {
      algorithm: params.algorithm,
      target: params.target,
      features: params.features,
      task: params.task,
      testSize: params.testSize,
      hyperparams: params.hyperparams,
    },
  };
  // G20 dataset-agnostic: always send rows alongside storagePath as fallback for universality (dirty, wide, anon 10k)
  // Storage is preferred for large full data; rows ensures training works even if Storage fetch fails (stale pending, LRU, anon)
  if (params.storagePath) {
    (body as Record<string, unknown>).storagePath = params.storagePath;
    if (params.cleaningConfig) {
      (body as Record<string, unknown>).cleaningConfig = params.cleaningConfig;
    }
    if (params.totalRowCount !== undefined) {
      (body as Record<string, unknown>).totalRowCount = params.totalRowCount;
    }
    // Always include rows as fallback — backend will prefer storage but use rows if storage fails (G19 inline with warning)
    (body as Record<string, unknown>).rows = params.rows;
    (body as Record<string, unknown>).columns = params.columns;
    try {
      const { getFirebaseStorage } = await import("@/config/firebase");
      const { ref, getDownloadURL } = await import("firebase/storage");
      const storage = getFirebaseStorage();
      if (storage) {
        const url = await getDownloadURL(
          ref(storage, params.storagePath as string),
        );
        (body as Record<string, unknown>).downloadUrl = url;
      }
    } catch (e) {
      if (import.meta.env.DEV)
        console.warn("[mlApi] getDownloadURL failed, using rows fallback", e);
    }
  } else {
    (body as Record<string, unknown>).rows = params.rows;
    (body as Record<string, unknown>).columns = params.columns;
    if (params.totalRowCount !== undefined) {
      (body as Record<string, unknown>).totalRowCount = params.totalRowCount;
    }
  }

  const authHeader = await getAuthHeader();
  const res = await fetch(ML_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  let data: unknown;
  try {
    const text = await readResponseText(res);
    // Handle NaN which Python's json may emit (even though we clean, be robust)
    const jsonText = text
      .replace(/\bNaN\b/g, "null")
      .replace(/\bInfinity\b/g, "null")
      .replace(/\b-Infinity\b/g, "null");
    data = JSON.parse(jsonText) as unknown;
  } catch {
    // Fallback to native json if text parsing fails
    try {
      data = (await res.json()) as unknown;
    } catch {
      throw new Error(
        sanitizeStatsError(
          `ML service returned non-JSON (status ${res.status})`,
        ),
      );
    }
  }

  // Top-level envelope error (Pydantic 422, 400, etc.)
  if (!res.ok) {
    const msg =
      isRecord(data) && typeof data["error"] === "string"
        ? (data["error"] as string)
        : `ML service error: ${res.status}`;
    throw new Error(sanitizeStatsError(msg));
  }
  if (isRecord(data) && typeof data["error"] === "string") {
    throw new Error(sanitizeStatsError(data["error"] as string));
  }
  let rawResult: unknown = data;
  if (isRecord(data) && hasProp(data, "result")) {
    const maybeResult = data["result"];
    rawResult = maybeResult ?? data;
  }
  // Backend training error returned as 200 with {error: "..."} inside result
  if (isRecord(rawResult) && rawResult["error"] && !rawResult["metrics"]) {
    const errorValue = rawResult["error"];
    const errorMessage =
      typeof errorValue === "string" ? errorValue : String(errorValue);
    throw new Error(sanitizeStatsError(errorMessage));
  }
  return normalizeTrainResult(rawResult);
}

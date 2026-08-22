/**
 * recommendations.ts — Unified dataset recommendations hook.
 *
 * Replaces the sync `RecommendationLaws.evaluate()` with an async API call to
 * the Python backend's `recommend_all` endpoint, with an offline fallback for
 * basic missing-value detection.
 *
 * Feature flag: set VITE_USE_UNIFIED_RECOMMENDATIONS=false to fall back to
 * the old synchronous `RecommendationLaws.evaluate()` path. Remove after 1 release.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { RecommendationLaws } from "@polymorpha/business-logic";
import type { Recommendation } from "@polymorpha/business-logic";
import type { Dataset } from "@/types";

// ─── Feature Flag ────────────────────────────────────────────────────────

const USE_UNIFIED =
  import.meta.env.VITE_USE_UNIFIED_RECOMMENDATIONS !== "false";

// ─── API Call ────────────────────────────────────────────────────────────

const ML_API_URL = "/api/v1/machine-learning";
const API_TIMEOUT_MS = 30_000;

async function fetchRecommendations(
  dataset: Dataset,
): Promise<{ recommendations: Recommendation[]; state: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(ML_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "recommend_all",
        rows: dataset.rows,
        columns: dataset.columns,
        cleaningDiff: {},
        statsResults: {},
        params: {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const json = await response.json();
    const result = json.result ?? json;

    // Log RAG state for pipeline interception
    if (result.state) {
      console.log("[RAG_STATE]", JSON.stringify(result.state, null, 2));
    }

    return {
      recommendations: (result.recommendations ?? []) as Recommendation[],
      state: (result.state ?? {}) as Record<string, unknown>,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Offline Fallback ────────────────────────────────────────────────────

const EMPTY_STATE: Record<string, unknown> = {
  rowCount: 0,
  columnCount: 0,
  pairsCapped: false,
  columnsAnalyzed: 0,
  totalColumns: 0,
  columnsAnalyzedList: [],
  columns: {},
  combinations: [],
};

function offlineFallback(dataset: Dataset): {
  recommendations: Recommendation[];
  state: Record<string, unknown>;
} {
  const recs: Recommendation[] = [];
  const nRows = dataset.rows?.length ?? 0;

  const columns: Record<string, unknown> = {};

  for (const col of dataset.columns ?? []) {
    let missingCount = 0;
    const uniqueSet = new Set<unknown>();

    for (const row of dataset.rows ?? []) {
      const val = row[col.name];
      if (val === null || val === undefined || val === "") {
        missingCount++;
      } else {
        uniqueSet.add(val);
      }
    }

    const missingPct = (missingCount / nRows) * 100;

    columns[col.name] = {
      name: col.name,
      type: col.type,
      missingCount,
      missingPercentage: Math.round(missingPct * 100) / 100,
      uniqueValues: uniqueSet.size,
    };

    if (missingPct > 10) {
      recs.push({
        id: `rec_missing_${col.name}`,
        type: "cleaning",
        reason: `Column '${col.name}' has ${missingPct.toFixed(1)}% missing values.`,
        action: "Recommend imputation or removing the column.",
      });
    }
  }

  return {
    recommendations: recs,
    state: {
      ...EMPTY_STATE,
      rowCount: nRows,
      columnCount: dataset.columns.length,
      columns,
    },
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────

interface RecommendationsResult {
  recommendations: Recommendation[];
  state: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  /** true when the offline fallback was used */
  offline: boolean;
}

/**
 * Fetch unified recommendations for a dataset.
 *
 * When the VITE_USE_UNIFIED_RECOMMENDATIONS feature flag is false, falls back
 * to the synchronous `RecommendationLaws.evaluate()` path (same as pre-migration).
 *
 * When online, calls POST /api/v1/machine-learning with action=recommend_all.
 * On network failure, falls back to offline missing-value detection.
 *
 * @param dataset - The dataset to analyze (raw or cleaned). Null = no dataset loaded.
 * @returns `{ recommendations, state, loading, error, offline }`
 */
export function useRecommendations(
  dataset: Dataset | null,
): RecommendationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState<{
    recommendations: Recommendation[];
    state: Record<string, unknown>;
  }>({ recommendations: [], state: {} });

  // Track last dataset hash to avoid re-fetching same data
  const lastHash = useRef<string>("");
  const mountedRef = useRef(true);

  const fetchRecs = useCallback(async (ds: Dataset) => {
    setLoading(true);
    setError(null);
    setOffline(false);

    try {
      const data = await fetchRecommendations(ds);
      if (mountedRef.current) {
        setResult(data);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Network failure or timeout — offline fallback
      const fallback = offlineFallback(ds);
      setResult(fallback);
      setOffline(true);
      setError(null); // offline is not an error
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dataset) {
      setResult({ recommendations: [], state: {} });
      return;
    }

    // Feature flag: use old sync path
    if (!USE_UNIFIED) {
      const recs = RecommendationLaws.evaluate(dataset);
      setResult({ recommendations: recs, state: {} });
      return;
    }

    // Simple hash to avoid re-fetching the same dataset
    const hash = `${dataset.rows?.length ?? 0}:${dataset.columns?.length ?? 0}:${dataset.fileName}`;
    if (hash === lastHash.current) return;
    lastHash.current = hash;

    fetchRecs(dataset);
  }, [dataset, fetchRecs]);

  return {
    recommendations: result.recommendations,
    state: result.state,
    loading,
    error,
    offline,
  };
}

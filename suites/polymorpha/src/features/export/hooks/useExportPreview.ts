import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset, ExportPreferences, StatsResults } from "@/types";
import type { ExportPreset } from "../types";
import {
  hashDatasetSync,
  hashExportPrefsSync,
  composeExportHash,
} from "../lib/hash";

export interface UseExportPreviewParams {
  format: "pdf" | "xlsx" | "csv";
  cleaned: Dataset | null;
  raw: Dataset | null;
  results: StatsResults | null;
  cleaningDiff: unknown;
  preferences: ExportPreferences;
  datasetName: string;
  preset: ExportPreset;
}

export interface UseExportPreviewResult {
  pdfDataUrl: string | null;
  loading: boolean;
  error: string | null;
  memoKey: string | null;
}

const CACHE = new Map<string, { dataUrl: string; ts: number }>();
const TTL_MS = 30_000;
const MAX_CACHE = 20;

function prune() {
  if (CACHE.size <= MAX_CACHE) return;
  const sorted = Array.from(CACHE.entries()).sort((a, b) => a[1].ts - b[1].ts);
  for (let i = 0; i < sorted.length - MAX_CACHE; i++)
    CACHE.delete(sorted[i][0]);
}

export function useExportPreview(
  params: UseExportPreviewParams,
): UseExportPreviewResult {
  const {
    format,
    cleaned,
    preferences,
    datasetName,
    preset,
    raw,
    results,
    cleaningDiff,
  } = params;
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const memoKey = useMemo(() => {
    if (!cleaned) return null;
    const dsHash = hashDatasetSync(cleaned, cleaned.fileName);
    const pHash = hashExportPrefsSync(preferences);
    return (
      composeExportHash(dsHash, pHash) +
      `__${format}__${preset}__${datasetName}`
    );
  }, [cleaned, preferences, format, preset, datasetName]);

  useEffect(() => {
    if (format !== "pdf" || !cleaned || !results || !memoKey) {
      setLoading(false);
      setError(null);
      if (format !== "pdf") setPdfDataUrl(null);
      return;
    }
    const cached = CACHE.get(memoKey);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setPdfDataUrl(cached.dataUrl);
      setLoading(false);
      setError(null);
      // SWR: still revalidate in background — fall through but show cached first
    } else {
      setPdfDataUrl(null);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const delay = cached ? 0 : 400;
        await new Promise<void>((r) => setTimeout(r, delay));
        if (controller.signal.aborted) return;
        const { generatePDFPreviewUrl } =
          await import("@polymorpha/business-logic");
        // Build opts via service helper to keep consistent
        const { buildPdfOptions } = await import("../lib/ExportService");
        const opts = buildPdfOptions({
          cleaned,
          raw,
          results,
          cleaningDiff: cleaningDiff as never,
          preferences,
          datasetName,
          preset,
        });
        if (import.meta.env.DEV) {
          console.debug("[export-preview] generating", {
            dataset: cleaned.fileName,
            rows: cleaned.rows.length,
            preset,
            memoKey: memoKey.slice(0, 24),
          });
        }
        const url = await generatePDFPreviewUrl(
          opts as never,
          {
            signal: controller.signal,
            onProgress: () => {},
          } as never,
        );
        if (cancelled || controller.signal.aborted) return;
        CACHE.set(memoKey, { dataUrl: url, ts: Date.now() });
        prune();
        // Keep previous preview visible if this is SWR; just update
        setPdfDataUrl(url);
        setLoading(false);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        // On abort, not error
        if (err instanceof DOMException && err.name === "AbortError") {
          setLoading(false);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (import.meta.env.DEV)
          console.error("[export-preview] failed", err, { memoKey });
        setError(msg);
        setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [
    format,
    cleaned,
    results,
    raw,
    cleaningDiff,
    preferences,
    datasetName,
    preset,
    memoKey,
  ]);

  return { pdfDataUrl, loading, error, memoKey };
}

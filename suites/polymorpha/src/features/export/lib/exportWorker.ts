/**
 * exportWorker — Web Worker for heavy export generation.
 * Loaded via `new Worker(new URL("./exportWorker.ts", import.meta.url), {type:"module"})`.
 * Communicates via postMessage with progress forwarding.
 * This file runs INSIDE the worker; host wraps it via `wrapExportWorker`.
 */
import type { Dataset, ExportPreferences, StatsResults } from "@/types";

export type WorkerRequest =
  | {
      id: string;
      kind: "pdf-preview";
      payload: {
        cleaned: Dataset;
        raw: Dataset | null;
        results: StatsResults;
        cleaningDiff: unknown;
        preferences: ExportPreferences;
        datasetName: string;
        preset: "essentials" | "standard" | "complete";
      };
    }
  | {
      id: string;
      kind: "pdf-blob";
      payload: {
        cleaned: Dataset;
        raw: Dataset | null;
        results: StatsResults;
        cleaningDiff: unknown;
        preferences: ExportPreferences;
        datasetName: string;
        preset: "essentials" | "standard" | "complete";
        fileBaseName: string;
      };
    }
  | {
      id: string;
      kind: "excel-blob";
      payload: {
        cleaned: Dataset;
        results: StatsResults;
        fileBaseName: string;
      };
    }
  | {
      id: string;
      kind: "csv-blob";
      payload: { cleaned: Dataset; fileBaseName: string };
    };

export type WorkerResponse =
  | { id: string; ok: true; kind: "pdf-preview"; dataUrl: string }
  | {
      id: string;
      ok: true;
      kind: "pdf-blob" | "excel-blob" | "csv-blob";
      blob: Blob;
    }
  | { id: string; ok: false; error: string }
  | { id: string; progress: number; phase: string };

// Worker entry — only execute in WorkerGlobalScope
void (
  typeof self !== "undefined" &&
  typeof (self as unknown as { importScripts?: unknown }).importScripts !==
    "undefined"
);

if (typeof self !== "undefined" && "onmessage" in self) {
  (self as unknown as Worker).onmessage = async (
    ev: MessageEvent<WorkerRequest>,
  ) => {
    const req = ev.data;
    const postProgress = (pct: number, phase: string) =>
      (self as unknown as Worker).postMessage({
        id: req.id,
        progress: pct,
        phase,
      } as WorkerResponse);

    try {
      if (req.kind === "pdf-preview") {
        const { generatePDFPreviewUrl, buildPDFDocDefinition } =
          await import("@polymorpha/business-logic");
        // Dynamic build to show progress
        const p = req.payload;
        const opts = {
          cleaned: p.cleaned,
          raw: p.raw,
          results: p.results,
          cleaningDiff: p.cleaningDiff as never,
          datasetName: p.datasetName,
          reportMode:
            p.preset === "essentials"
              ? ("basic" as const)
              : p.preset === "complete"
                ? ("premium" as const)
                : ("statistical" as const),
          includeVisuals: p.preferences.includeVisuals,
          exportPreferences: p.preferences,
        };
        const dataUrl = await generatePDFPreviewUrl(opts as never, {
          onProgress: postProgress,
          signal: undefined as unknown as AbortSignal,
        });
        (self as unknown as Worker).postMessage({
          id: req.id,
          ok: true,
          kind: "pdf-preview",
          dataUrl,
        } as WorkerResponse);
        // Avoid unused warning
        void buildPDFDocDefinition;
      } else if (req.kind === "pdf-blob") {
        const p = req.payload;
        const { generateExcelBlob, generatePdfBlob } =
          await import("./ExportService");
        // Reuse ExportService logic but inside worker — avoid DOM triggerDownload
        void generateExcelBlob;
        const blob = await generatePdfBlob({
          cleaned: p.cleaned,
          raw: p.raw,
          results: p.results,
          cleaningDiff: p.cleaningDiff as never,
          preferences: p.preferences,
          datasetName: p.datasetName,
          preset: p.preset,
          fileBaseName: p.fileBaseName,
          onProgress: postProgress,
        });
        (self as unknown as Worker).postMessage({
          id: req.id,
          ok: true,
          kind: "pdf-blob",
          blob,
        } as WorkerResponse);
      } else if (req.kind === "excel-blob") {
        const { generateExcelBlob } = await import("./ExportService");
        const blob = await generateExcelBlob(req.payload);
        (self as unknown as Worker).postMessage({
          id: req.id,
          ok: true,
          kind: "excel-blob",
          blob,
        } as WorkerResponse);
      } else if (req.kind === "csv-blob") {
        const { generateCsvBlob } = await import("./ExportService");
        const blob = await generateCsvBlob(req.payload);
        (self as unknown as Worker).postMessage({
          id: req.id,
          ok: true,
          kind: "csv-blob",
          blob,
        } as WorkerResponse);
      }
    } catch (err) {
      (self as unknown as Worker).postMessage({
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } as WorkerResponse);
    }
  };
}

export async function wrapExportWorker(worker: Worker) {
  return worker;
}

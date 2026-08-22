import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/store/useDataStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { RecommendButton } from "@/components/RecommendButton/RecommendButton";
import { useExportStore } from "./store/useExportStore";
import { FormatPicker } from "./components/FormatPicker";
import { ReportBuilder } from "./components/ReportBuilder";
import { LivePreview } from "./components/LivePreview";
import { ExportActions } from "./components/ExportActions";
import { SaveDialog } from "./components/SaveDialog";
import { useExportPreview } from "./hooks/useExportPreview";
import { useExportController } from "./hooks/useExportController";
import {
  descriptiveRowsFromResults,
  testRowsFromResults,
} from "./lib/rowMappers";
import { visualLabelFromKey } from "./lib/rowMappers";
import { CHART_COLORS } from "@/lib/palette";
import type { VisualCandidate } from "./types";

export function ExportPanel({ onExport }: { onExport?: () => void }) {
  const { cleaned, results } = useDataStore(
    useShallow((s) => ({
      cleaned: s.cleaned,
      results: s.results,
    })),
  );
  const totalRowCount = useDataStore((s) => s.totalRowCount);
  const storagePath = useDataStore((s) => s.storagePath);
  const cleaningConfig = useDataStore((s) => s.cleaningConfig);
  const cleaningDiff = useDataStore((s) => s.cleaningDiff);
  const raw = useDataStore((s) => s.raw);
  const wsId = useDataStore((s) => s.workspaceId);

  const store = useExportStore();
  const [showSave, setShowSave] = useState(false);

  // Hydrate datasetName from cleaned fileName once
  useEffect(() => {
    if (!cleaned) return;
    const base = cleaned.fileName.replace(/\.[^.]+$/, "");
    if (!store.datasetName) store.setDatasetName(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleaned?.fileName]);

  // G24 reuse: notebook is native model, but export's canonical source is pipeline cleaned/results.
  // Fallback: if pipeline cleaned is null but raw exists (e.g., 0 rows removed), use raw. If results null,
  // allow degraded preview (empty stats) so PDF iframe still renders — then surface inline warning.
  const effectiveCleaned = cleaned ?? raw ?? null;
  const effectiveResults = useMemo(() => {
    if (results) return results;
    // degraded empty results so pdf can still render dataset table
    return {
      descriptive: [],
      frequencies: [],
      correlation: null,
      normality: [],
      tTests: [],
      anova: [],
      regression: [],
      mannWhitney: [],
      kruskalWallis: [],
      chiSquare: [],
    } as unknown as typeof results & NonNullable<typeof results>;
  }, [results]);

  const degradedWarning =
    !cleaned && raw
      ? "Cleaned dataset not yet materialized — using raw data for preview. Run Process if you expect cleaning."
      : !results
        ? "Analysis results not yet computed — preview will show dataset only. Run Analyse for full report."
        : null;

  const numericCols = useMemo(
    () => (effectiveCleaned?.columns ?? []).filter((c) => c.type === "numeric"),
    [effectiveCleaned],
  );
  const categoricalCols = useMemo(
    () =>
      (effectiveCleaned?.columns ?? []).filter((c) => c.type === "categorical"),
    [effectiveCleaned],
  );

  const visualCandidates = useMemo<VisualCandidate[]>(() => {
    return Array.from(new Set(store.includedVisualKeys)).map((key, i) => ({
      key,
      label: visualLabelFromKey(key),
      color:
        (store.preferences.visualKeyColors?.[key] as string | undefined) ??
        CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [store.includedVisualKeys, store.preferences.visualKeyColors]);

  const totalTests = useMemo(() => {
    if (!effectiveResults) return 0;
    return (
      (effectiveResults.tTests?.length ?? 0) +
      (effectiveResults.anova?.length ?? 0) +
      (effectiveResults.regression?.length ?? 0) +
      (effectiveResults.mannWhitney?.length ?? 0) +
      (effectiveResults.kruskalWallis?.length ?? 0) +
      (effectiveResults.chiSquare?.length ?? 0)
    );
  }, [effectiveResults]);

  const normalizedDatasetName =
    store.datasetName.trim().length > 0
      ? store.datasetName.trim()
      : (effectiveCleaned?.fileName.replace(/\.[^.]+$/, "") ?? "dataset");

  const preview = useExportPreview({
    format: store.format,
    cleaned: effectiveCleaned,
    raw,
    results: effectiveResults as never,
    cleaningDiff,
    preferences: store.preferences,
    datasetName: normalizedDatasetName,
    preset: store.preset,
  });

  const ctrl = useExportController({
    cleaned: effectiveCleaned,
    raw,
    results: effectiveResults as never,
    cleaningDiff,
    storagePath,
    totalRowCount,
    cleaningConfig: cleaningConfig as unknown,
  });

  const previewTables = useMemo(() => {
    if (!effectiveCleaned) return {};
    if (store.format === "csv") {
      return {
        cleaned: {
          columns: effectiveCleaned.columns.map((c) => ({
            name: c.name,
            type: c.type,
          })),
          rows: effectiveCleaned.rows as Record<string, unknown>[],
        },
      };
    }
    if (store.format === "xlsx" && effectiveResults) {
      const desc = descriptiveRowsFromResults(effectiveResults as never);
      const tests = testRowsFromResults(effectiveResults as never);
      return {
        cleaned: {
          columns: effectiveCleaned.columns.map((c) => ({
            name: c.name,
            type: c.type,
          })),
          rows: effectiveCleaned.rows as Record<string, unknown>[],
        },
        descriptive: desc.length
          ? {
              columns: Object.keys(desc[0] ?? {}).map((name) => ({ name })),
              rows: desc as Record<string, unknown>[],
            }
          : { columns: [], rows: [] },
        tests: tests.length
          ? {
              columns: Object.keys(tests[0] ?? {}).map((name) => ({ name })),
              rows: tests as Record<string, unknown>[],
            }
          : { columns: [], rows: [] },
      };
    }
    return {
      cleaned: {
        columns: effectiveCleaned.columns.map((c) => ({
          name: c.name,
          type: c.type,
        })),
        rows: effectiveCleaned.rows as Record<string, unknown>[],
      },
    };
  }, [effectiveCleaned, effectiveResults, store.format]);

  if (!effectiveCleaned) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export Centre</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete cleaning and analysis to enable exports. Ensure you have a
            cleaned dataset and computed results.
          </p>
          {degradedWarning ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {degradedWarning}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const formatLabel =
    store.format === "pdf"
      ? `PDF (${store.preset})`
      : store.format === "xlsx"
        ? "Excel Workbook"
        : "Cleaned CSV";
  const canGenerate =
    !!effectiveCleaned && !ctrl.generating && !store.generating;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      {degradedWarning ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          {degradedWarning}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Export Centre</h2>
          <p className="text-sm text-muted-foreground">
            {normalizedDatasetName} ·{" "}
            {(totalRowCount ?? effectiveCleaned.rows.length).toLocaleString()}{" "}
            rows × {effectiveCleaned.columns.length} columns
          </p>
          <div className="mt-2 flex max-w-md items-center gap-2">
            <label htmlFor="exp-dataset-name" className="text-xs font-medium">
              Dataset name
            </label>
            <input
              id="exp-dataset-name"
              className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
              value={store.datasetName}
              onChange={(e) => store.setDatasetName(e.target.value)}
              placeholder="Dataset name for exports"
            />
          </div>
        </div>
        <RecommendButton stage="export" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(380px,42%)_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <FormatPicker
                format={store.format}
                setFormat={store.setFormat}
                preset={store.preset}
                setPreset={store.setPreset}
                disabled={store.generating || ctrl.generating}
              />
            </CardContent>
          </Card>

          {store.format === "pdf" ? (
            <ReportBuilder
              preferences={store.preferences}
              setPreferences={store.setPreferences}
              cleaned={effectiveCleaned}
              numericCols={numericCols}
              categoricalCols={categoricalCols}
              visualCandidates={visualCandidates}
              totalTests={totalTests}
            />
          ) : null}

          <Card>
            <CardContent className="pt-4">
              <ExportActions
                formatLabel={formatLabel}
                canGenerate={canGenerate}
                generating={store.generating || ctrl.generating}
                phase={store.phase || ctrl.phase}
                progress={store.progress || ctrl.progress}
                onGenerate={() => void ctrl.handleGenerate()}
                onCancel={ctrl.handleCancel}
                lastFileName={ctrl.lastFileName}
                canSave={!!wsId && !!ctrl.lastBlob}
                onSave={() =>
                  void ctrl.handleSaveToWorkspace().then(() => onExport?.())
                }
                saving={store.generating}
                error={store.error || ctrl.error}
                fallbackWarning={ctrl.fallbackWarning}
              />
            </CardContent>
          </Card>
        </div>

        <LivePreview
          format={store.format}
          pdfDataUrl={preview.pdfDataUrl}
          pdfLoading={preview.loading}
          pdfError={preview.error}
          cleanedRowCount={effectiveCleaned.rows.length}
          totalRowCount={totalRowCount ?? effectiveCleaned.rows.length}
          previewTables={previewTables as never}
          generationInProgress={store.generating || ctrl.generating}
          generationPhase={store.phase || ctrl.phase}
          generationProgress={store.progress || ctrl.progress}
        />
      </div>

      <SaveDialog
        open={showSave}
        onOpenChange={setShowSave}
        fileName={ctrl.lastFileName}
        saving={store.generating}
        onSave={() =>
          void ctrl.handleSaveToWorkspace().then(() => setShowSave(false))
        }
        onSkip={() => setShowSave(false)}
      />
    </div>
  );
}

/**
 * useCleaningPanelState — all state + derived values for the CleaningPanel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  applyCleaningConfig,
  validateCleaningConfig,
} from "@polymorpha/business-logic";
import { sanitizeProcessError } from "@/lib/errors/sanitize";
import { isLikelyIdentifierColumn } from "@/components/AnalysePanel/analyseHelpers";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import { computeDescriptive, computeFrequency } from "@/lib/stats/descriptive";
import { useRecommendations } from "@/lib/stats/recommendations";
import { useDataStore } from "@/store/useDataStore";
import { CLEAN_STEPS, CLEAN_TREE, EMPTY_DATASET } from "./constants";
import { TAB_ID } from "./components/TabBar/constants";
import type { TabId } from "./components/TabBar/constants";
import { buildImpactSummary } from "./components/HistoryControls/utils";
import type { StepPreview } from "./components/HistoryControls/types";
import { groupOfStep, isOutlierCandidate } from "./utils";
import type { CleanStepId } from "./types";
import type { CleaningConfig } from "@/types";
import {
  computeConfiguredSteps,
  computeDataScanIssues,
  computeDuplicateLiveCount,
  computeMissingColumns,
  computeMissingFillPreview,
  computeOutlierLiveCount,
  computeRowGateWarning,
} from "./cleaningPanelDerived";

export function useCleaningPanelState() {
  const {
    baseRaw,
    appliedSteps,
    stepCache,
    cleaned,
    cleaningConfig,
    cleaningDiff,
    setCleaningConfig,
  } = useDataStore(
    useShallow((state) => ({
      baseRaw: state.raw,
      appliedSteps: state.appliedSteps,
      stepCache: state.stepCache,
      cleaned: state.cleaned,
      cleaningConfig: state.cleaningConfig,
      cleaningDiff: state.cleaningDiff,
      setCleaningConfig: state.setCleaningConfig,
    })),
  );

  const raw = useMemo(() => {
    if (appliedSteps.length > 0 && baseRaw) {
      const lastStep = appliedSteps[appliedSteps.length - 1];
      return stepCache.get(lastStep.id) || baseRaw;
    }
    return baseRaw;
  }, [baseRaw, appliedSteps, stepCache]);

  const [showResolvedMissing, setShowResolvedMissing] = useState(false);
  const [missingFocus, setMissingFocus] = useState("");
  const [outlierFocus, setOutlierFocus] = useState("");
  const [columnFocus, setColumnFocus] = useState("");
  const [activeStep, setActiveStep] = useState<CleanStepId>(
    CLEAN_STEPS.rowGate,
  );
  const [openGroups, setOpenGroups] = useState<string[]>(() => [
    groupOfStep(CLEAN_STEPS.rowGate),
  ]);
  const [stepDrawerOpen, setStepDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(TAB_ID.data);

  const safeRaw = raw ?? EMPTY_DATASET;
  const totalRows = safeRaw.rows.length;

  const typeOverrideMap = useMemo(
    () =>
      new Map(
        (cleaningConfig?.typeOverrides ?? []).map((override) => [
          override.columnName,
          override.type,
        ]),
      ),
    [cleaningConfig?.typeOverrides],
  );

  const numericColumns = useMemo(
    () =>
      safeRaw.columns.filter(
        (column) =>
          (typeOverrideMap.get(column.name) ?? column.type) === "numeric",
      ),
    [safeRaw.columns, typeOverrideMap],
  );
  const outlierColumns = useMemo(
    () =>
      numericColumns.filter(
        (column) =>
          isOutlierCandidate(safeRaw.rows, column.name) &&
          !isLikelyIdentifierColumn(
            column.name,
            safeRaw.rows.map((row) => row[column.name]),
          ),
      ),
    [numericColumns, safeRaw.rows],
  );
  const skippedOutlierColumns = useMemo(
    () =>
      numericColumns.filter((column) =>
        isLikelyIdentifierColumn(
          column.name,
          safeRaw.rows.map((row) => row[column.name]),
        ),
      ),
    [numericColumns, safeRaw.rows],
  );

  // Exploration stats from cleaned data (or raw data as fallback)
  const exploreData = cleaned ?? raw;
  const exploreRecommendations = useRecommendations(exploreData);
  const exploreCols = useMemo(() => {
    if (!exploreData) {
      return null;
    }
    const numericCols = exploreData.columns
      .filter((c) => c.type === "numeric")
      .filter(
        (c) =>
          !isLikelyIdentifierColumn(
            c.name,
            exploreData.rows.map((row) => row[c.name]),
          ),
      )
      .map((c) => c.name);
    const catCols = exploreData.columns
      .filter((c) => c.type === "categorical")
      .map((c) => c.name);
    return { numericCols, catCols };
  }, [exploreData]);

  const [exploreComputed, setExploreComputed] = useState<ComputedStats | null>(
    null,
  );

  useEffect(() => {
    if (!exploreData || !exploreCols) {
      setExploreComputed(null);
      return;
    }
    let cancelled = false;
    const { numericCols, catCols } = exploreCols;
    Promise.all([
      Promise.all(
        numericCols.map((col) => computeDescriptive(exploreData.rows, col)),
      ),
      Promise.all(
        catCols.map((col) => computeFrequency(exploreData.rows, col)),
      ),
    ]).then(([descriptive, frequencies]) => {
      if (!cancelled) {
        setExploreComputed({
          descriptive,
          frequencies,
          correlation: null,
          normality: [],
          numericCols,
          catCols,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [exploreData, exploreCols]);

  const [configHistory, setConfigHistory] = useState<CleaningConfig[]>([]);
  const [configFuture, setConfigFuture] = useState<CleaningConfig[]>([]);
  const [stepPreview, setStepPreview] = useState<StepPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleUndo = useCallback(() => {
    if (configHistory.length === 0 || !cleaningConfig) {
      return;
    }
    const prev = configHistory[configHistory.length - 1];
    setConfigHistory((history) => history.slice(0, -1));
    setConfigFuture((future) => [...future, cleaningConfig]);
    setStepPreview(null);
    setCleaningConfig(prev);
  }, [configHistory, cleaningConfig, setCleaningConfig]);

  const handleRedo = useCallback(() => {
    if (configFuture.length === 0 || !cleaningConfig) {
      return;
    }
    const next = configFuture[configFuture.length - 1];
    setConfigFuture((future) => future.slice(0, -1));
    setConfigHistory((history) => [...history, cleaningConfig]);
    setStepPreview(null);
    setCleaningConfig(next);
  }, [configFuture, cleaningConfig, setCleaningConfig]);

  const configWarnings = useMemo(() => {
    if (!raw || !cleaningConfig) {
      return [];
    }
    return validateCleaningConfig(raw, cleaningConfig);
  }, [raw, cleaningConfig]);

  const activeStepWarnings = useMemo(() => {
    const stepWarningMap: Partial<Record<CleanStepId, string[]>> = {
      [CLEAN_STEPS.rowGate]: ["Row filter", "Sampling"],
      [CLEAN_STEPS.missing]: ["Missing values"],
      [CLEAN_STEPS.outliers]: ["Outliers"],
      [CLEAN_STEPS.columns]: ["Remove columns"],
      [CLEAN_STEPS.stringReplace]: ["String replace"],
      [CLEAN_STEPS.standardize]: ["Category mapping"],
      [CLEAN_STEPS.mathTransform]: ["Math transform"],
      [CLEAN_STEPS.bin]: ["Binning"],
      [CLEAN_STEPS.dateExtract]: ["Date extraction"],
      [CLEAN_STEPS.derived]: ["Derived column"],
      [CLEAN_STEPS.lagLead]: ["Lag/Lead"],
      [CLEAN_STEPS.interaction]: ["Interaction"],
      [CLEAN_STEPS.sort]: ["Sort"],
    };
    const steps = stepWarningMap[activeStep] ?? [];
    return configWarnings.filter((w) => steps.includes(w.step));
  }, [configWarnings, activeStep]);

  const handlePreviewStep = useCallback(() => {
    if (!raw || !cleaningConfig) {
      return;
    }
    setIsPreviewing(true);
    setPreviewError(null);
    requestAnimationFrame(() => {
      try {
        const result = applyCleaningConfig(raw, cleaningConfig);
        const d = result.diff;
        setStepPreview({
          rowsRemoved: d.rowsRemoved,
          valuesImputed: Object.values(d.valuesImputed).reduce(
            (s, v) => s + v,
            0,
          ),
          outliersHandled: Object.values(d.outliersHandled).reduce(
            (s, v) => s + v,
            0,
          ),
          columnsRemoved: d.columnsRemoved ?? 0,
          diff: d,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "object" &&
                err !== null &&
                "message" in err &&
                typeof (err as Record<string, unknown>).message === "string"
              ? ((err as Record<string, unknown>).message as string)
              : "Preview failed due to an unexpected error.";
        setPreviewError(sanitizeProcessError(message));
      } finally {
        setIsPreviewing(false);
      }
    });
  }, [raw, cleaningConfig]);

  // Determine which steps have been configured (differ from defaults)
  const configuredSteps = useMemo(
    () => computeConfiguredSteps(cleaningConfig, raw),
    [cleaningConfig, raw],
  );

  // Auto-scan: surface top data issues
  const dataScanIssues = useMemo(
    () =>
      computeDataScanIssues(
        raw,
        numericColumns,
        exploreRecommendations.recommendations,
      ),
    [raw, numericColumns, exploreRecommendations.recommendations],
  );

  // Inline impact warning for row gate
  const rowGateWarning = useMemo(
    () => computeRowGateWarning(raw, cleaningConfig),
    [raw, cleaningConfig],
  );

  const diff = cleaningDiff;
  const totalCells = totalRows * (raw?.columns.length ?? 1);
  const hasCleaned = !!diff && !!cleaned;

  const impact = useMemo(
    () =>
      buildImpactSummary({
        diff,
        stepPreview,
        totalRows,
        totalCells,
      }),
    [diff, stepPreview, totalRows, totalCells],
  );

  const impactCount = useMemo(
    () =>
      impact.items.filter(
        (item) => item.value !== undefined && item.value !== "0",
      ).length,
    [impact],
  );

  const missingColumns = useMemo(
    () => computeMissingColumns(raw, cleaningConfig),
    [raw, cleaningConfig],
  );
  const visibleMissingColumns = useMemo(
    () =>
      showResolvedMissing
        ? missingColumns
        : missingColumns.filter((entry) => entry.hasAttention),
    [showResolvedMissing, missingColumns],
  );
  const highAttentionMissing = missingColumns.filter(
    (entry) => entry.missing > 0,
  ).length;
  const activeMissingColumnName = visibleMissingColumns.some(
    (entry) => entry.column.name === missingFocus,
  )
    ? missingFocus
    : (visibleMissingColumns[0]?.column.name ?? "");
  const activeMissingColumn =
    visibleMissingColumns.find(
      (entry) => entry.column.name === activeMissingColumnName,
    ) ?? null;
  const activeOutlierColumnName = outlierColumns.some(
    (column) => column.name === outlierFocus,
  )
    ? outlierFocus
    : (outlierColumns[0]?.name ?? "");
  const activeOutlierColumn =
    outlierColumns.find((column) => column.name === activeOutlierColumnName) ??
    null;
  const activeColumnFocusName = safeRaw.columns.some(
    (column) => column.name === columnFocus,
  )
    ? columnFocus
    : (safeRaw.columns[0]?.name ?? "");
  const activeColumn =
    safeRaw.columns.find((column) => column.name === activeColumnFocusName) ??
    null;

  // Live outlier count for active column
  const outlierLiveCount = useMemo(() => {
    if (activeStep !== CLEAN_STEPS.outliers || !raw || !cleaningConfig) {
      return null;
    }
    return computeOutlierLiveCount(
      raw,
      cleaningConfig,
      activeOutlierColumnName,
    );
  }, [activeStep, raw, cleaningConfig, activeOutlierColumnName]);

  // Live duplicate count
  const duplicateLiveCount = useMemo(() => {
    if (activeStep !== CLEAN_STEPS.duplicates || !raw || !cleaningConfig) {
      return null;
    }
    return computeDuplicateLiveCount(raw, cleaningConfig);
  }, [activeStep, raw, cleaningConfig]);

  // Computed fill value for active missing column
  const missingFillPreview = useMemo(() => {
    if (activeStep !== CLEAN_STEPS.missing || !raw || !cleaningConfig) {
      return null;
    }
    return computeMissingFillPreview(
      raw,
      cleaningConfig,
      activeMissingColumnName,
    );
  }, [activeStep, raw, cleaningConfig, activeMissingColumnName]);

  const rowGateProps = useMemo(
    () => ({ warning: rowGateWarning }),
    [rowGateWarning],
  );

  const missingProps = useMemo(
    () => ({
      showResolved: showResolvedMissing,
      onToggleShowResolved: () => setShowResolvedMissing((v) => !v),
      columns: visibleMissingColumns,
      highAttentionCount: highAttentionMissing,
      activeColumn: activeMissingColumn,
      activeColumnName: activeMissingColumnName,
      onFocusColumn: setMissingFocus,
      fillPreview: missingFillPreview,
    }),
    [
      showResolvedMissing,
      visibleMissingColumns,
      highAttentionMissing,
      activeMissingColumn,
      activeMissingColumnName,
      missingFillPreview,
    ],
  );

  const outlierProps = useMemo(
    () => ({
      candidates: outlierColumns,
      skipped: skippedOutlierColumns,
      activeColumn: activeOutlierColumn,
      activeColumnName: activeOutlierColumnName,
      onFocusColumn: setOutlierFocus,
      liveCount: outlierLiveCount,
    }),
    [
      outlierColumns,
      skippedOutlierColumns,
      activeOutlierColumn,
      activeOutlierColumnName,
      outlierLiveCount,
    ],
  );

  const duplicatesProps = useMemo(
    () => ({ liveCount: duplicateLiveCount }),
    [duplicateLiveCount],
  );

  const columnsProps = useMemo(
    () => ({
      activeColumn,
      activeColumnName: activeColumnFocusName,
      onFocusColumn: setColumnFocus,
    }),
    [activeColumn, activeColumnFocusName],
  );

  const exploreProps = useMemo(
    () => ({ data: exploreData, computed: exploreComputed }),
    [exploreData, exploreComputed],
  );

  const updateConfig = useCallback(
    (next: CleaningConfig) => {
      if (cleaningConfig) {
        setConfigHistory((history) => [...history.slice(-19), cleaningConfig]);
        setConfigFuture([]);
      }
      setCleaningConfig(next);
      setStepPreview(null);
    },
    [cleaningConfig, setCleaningConfig],
  );

  const activeStepLabel =
    CLEAN_TREE.flatMap((g) => g.items).find((i) => i.id === activeStep)
      ?.label ?? "";

  return {
    raw,
    safeRaw,
    totalRows,
    totalCells,
    cleaned,
    cleaningConfig,
    numericColumns,
    outlierColumns,
    skippedOutlierColumns,
    exploreData,
    exploreProps,
    stepPreview,
    setStepPreview,
    isPreviewing,
    previewError,
    configWarnings,
    activeStepWarnings,
    handlePreviewStep,
    configuredSteps,
    dataScanIssues,
    rowGateProps,
    diff,
    hasCleaned,
    impact,
    impactCount,
    handleUndo,
    handleRedo,
    canUndo: configHistory.length > 0,
    canRedo: configFuture.length > 0,
    missingProps,
    outlierProps,
    duplicatesProps,
    columnsProps,
    updateConfig,
    activeStep,
    setActiveStep,
    openGroups,
    setOpenGroups,
    stepDrawerOpen,
    setStepDrawerOpen,
    activeTab,
    setActiveTab,
    activeStepLabel,
    handleIssueSelect: (step: CleanStepId) => {
      setOpenGroups([groupOfStep(step)]);
      setActiveStep(step);
      setActiveTab(TAB_ID.workflow);
    },
  };
}

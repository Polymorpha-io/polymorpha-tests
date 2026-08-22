/**
 * cleaningPanelDerived — D18/G15 delegation to @polymorpha/business-logic
 * Single source of truth: node_modules/@polymorpha/business-logic/ts/src/core/cleaningDerived.ts
 * All pure computations re-exported; no local duplication.
 */
import {
  computeDataScanIssues as blComputeDataScanIssues,
  computeMissingColumns as blComputeMissingColumns,
  computeOutlierLiveCount as blComputeOutlierLiveCount,
  computeDuplicateLiveCount as blComputeDuplicateLiveCount,
  computeMissingFillPreview as blComputeMissingFillPreview,
  computeRowGateWarning as blComputeRowGateWarning,
  computeConfiguredSteps as blComputeConfiguredSteps,
} from "@polymorpha/business-logic";
import type { CleaningConfig, Dataset } from "@/types";
import type { CleanStepId, DetectedIssue } from "./types";
import type {
  MissingColumnEntry,
  LiveOutlierCount,
} from "@polymorpha/business-logic";

// Re-export pure utils directly (signatures identical)
export {
  missingCount,
  isOutlierCandidate,
  missingSeverity,
  recommendedMissingStrategy,
  groupOfStep,
  CLEAN_STEPS,
} from "@polymorpha/business-logic";

// Wrapped derived helpers — delegate to BL but narrow to local DetectedIssue type
export function computeConfiguredSteps(
  cleaningConfig: CleaningConfig | null,
  raw: Dataset | null,
): Set<CleanStepId> {
  return blComputeConfiguredSteps(
    cleaningConfig as never,
    raw as never,
  ) as Set<CleanStepId>;
}

export function computeDataScanIssues(
  raw: Dataset | null,
  numericColumns: Dataset["columns"],
  recommendations: { reason: string }[],
): DetectedIssue[] {
  return blComputeDataScanIssues(
    raw as never,
    numericColumns as never,
    recommendations,
  ) as DetectedIssue[];
}

export function computeRowGateWarning(
  raw: Dataset | null,
  cleaningConfig: CleaningConfig | null,
): { rows: number; pct: number } | null {
  return blComputeRowGateWarning(raw as never, cleaningConfig as never);
}

export function computeMissingColumns(
  raw: Dataset | null,
  cleaningConfig: CleaningConfig | null,
): MissingColumnEntry[] {
  return blComputeMissingColumns(
    raw as never,
    cleaningConfig as never,
  ) as unknown as MissingColumnEntry[];
}

export function computeOutlierLiveCount(
  raw: Dataset | null,
  cleaningConfig: CleaningConfig | null,
  colName: string,
): LiveOutlierCount | null {
  return blComputeOutlierLiveCount(
    raw as never,
    cleaningConfig as never,
    colName,
  ) as unknown as LiveOutlierCount | null;
}

export function computeDuplicateLiveCount(
  raw: Dataset | null,
  cleaningConfig: CleaningConfig | null,
): { count: number; total: number } | null {
  return blComputeDuplicateLiveCount(raw as never, cleaningConfig as never);
}

export function computeMissingFillPreview(
  raw: Dataset | null,
  cleaningConfig: CleaningConfig | null,
  colName: string,
): { label: string; value: string; nonMissing: number } | null {
  return blComputeMissingFillPreview(
    raw as never,
    cleaningConfig as never,
    colName,
  );
}

// Re-export types for consumers that import from this module
export type {
  MissingColumnEntry,
  LiveOutlierCount,
} from "@polymorpha/business-logic";
export type { DetectedIssue, CleanStepId } from "./types";

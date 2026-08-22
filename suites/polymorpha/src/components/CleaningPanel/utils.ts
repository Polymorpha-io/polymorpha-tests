/**
 * utils — D18/G15 delegation to @polymorpha/business-logic
 * Re-exports cleaningDerived helpers as single source of truth.
 * See node_modules/@polymorpha/business-logic/ts/src/core/cleaningDerived.ts:51
 */
export {
  missingCount,
  isOutlierCandidate,
  missingSeverity,
  recommendedMissingStrategy,
  groupOfStep,
} from "@polymorpha/business-logic";
export type { CleanStepId, DetectedIssue } from "@polymorpha/business-logic";

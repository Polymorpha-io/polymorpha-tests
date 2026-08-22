import type {
  DetectedIssue,
  DetectedIssueSeverity,
} from "@/components/CleaningPanel/types";
import { severityRank } from "./constants";

export function getSeverityCounts(
  issues: readonly DetectedIssue[],
): Record<DetectedIssueSeverity, number> {
  const counts: Record<DetectedIssueSeverity, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const issue of issues) {
    counts[issue.severity] += 1;
  }

  return counts;
}

export function getVisibleIssues(issues: readonly DetectedIssue[]) {
  return [...issues].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
}

import type { DetectedIssueSeverity } from "@/components/CleaningPanel/types";

export const severityLevels: readonly DetectedIssueSeverity[] = [
  "high",
  "medium",
  "low",
];

export const severityRank: Record<DetectedIssueSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

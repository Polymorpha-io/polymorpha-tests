import type { DetectedIssueSeverity } from "@/components/CleaningPanel/types";

export const severityClassNames: Record<DetectedIssueSeverity, string> = {
  high: "bg-chart-2 text-primary-foreground",
  medium: "bg-chart-2/10 text-chart-2",
  low: "bg-muted text-muted-foreground",
};

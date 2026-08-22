import { Badge } from "@/components/shadcn/badge";
import { cn } from "@/lib/shadcn/utils";
import { severityLevels } from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/constants";
import { severityClassNames } from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/styles";
import type { DetectedIssueSeverity } from "@/components/CleaningPanel/types";

type SeverityTallyProps = {
  severityCounts: Record<DetectedIssueSeverity, number>;
};

export default function SeverityTally({ severityCounts }: SeverityTallyProps) {
  return (
    <div
      className="mb-3 flex items-center gap-2"
      aria-label="Issue severity summary"
    >
      {severityLevels
        .filter((severity) => severityCounts[severity] > 0)
        .map((severity) => (
          <Badge
            key={severity}
            className={cn(
              "h-auto rounded-[6px] px-2 py-0.5 font-mono text-[11px] font-bold uppercase",
              severityClassNames[severity],
            )}
          >
            {severityCounts[severity]} {severity}
          </Badge>
        ))}
    </div>
  );
}

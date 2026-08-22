import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/shadcn/utils";
import { severityClassNames } from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/styles";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";

type IssueListProps = {
  issues: readonly DetectedIssue[];
  onIssueSelect: (step: CleanStepId) => void;
};

export default function IssueList({ issues, onIssueSelect }: IssueListProps) {
  return (
    <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-0.5">
      {issues.map((issue, index) => (
        <Button
          key={`${issue.step}-${index}`}
          variant="outline"
          type="button"
          className="h-auto w-full justify-start gap-2 rounded-lg border-border bg-background px-2.5 py-2 text-left text-[13px] leading-tight font-normal whitespace-normal hover:bg-muted"
          aria-label={issue.label}
          onClick={() => onIssueSelect(issue.step)}
        >
          <Badge
            className={cn(
              "h-auto rounded px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold",
              severityClassNames[issue.severity],
            )}
          >
            {issue.severity.toUpperCase()}
          </Badge>
          <span className="min-w-0 flex-1">{issue.label}</span>
          <ChevronRight
            data-icon="inline-end"
            className="ml-auto text-muted-foreground"
          />
        </Button>
      ))}
    </div>
  );
}

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
} from "@/components/shadcn/popover";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";
import {
  getSeverityCounts,
  getVisibleIssues,
} from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/utils";
import { severityLevels } from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/constants";
import IssuesTrigger from "@/components/CleaningPanel/components/HistoryControls/components/IssuesPopover/components/IssuesTrigger";
import SeverityTally from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/components/SeverityTally";
import IssueList from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/components/IssueList";

type IssuesPopoverProps = {
  issues?: readonly DetectedIssue[];
  issuesDisabled?: boolean;
  onIssueSelect?: (step: CleanStepId) => void;
};

export function IssuesPopover({
  issues,
  issuesDisabled,
  onIssueSelect,
}: IssuesPopoverProps) {
  const [open, setOpen] = useState(false);
  const liveIssues = issues ?? [];
  const issueCount = issues?.length ?? 0;
  const severityCounts = getSeverityCounts(liveIssues);
  const visibleIssues = getVisibleIssues(liveIssues);

  function handleIssueSelect(step: CleanStepId) {
    onIssueSelect?.(step);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <IssuesTrigger issueCount={issueCount} disabled={issuesDisabled} />
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        role="dialog"
        aria-label="Detected issues"
        className="w-100 max-w-[calc(100vw-2rem)] gap-0 rounded-lg border-border p-3"
      >
        <PopoverTitle className="mb-2.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          Detected issues
        </PopoverTitle>

        {severityLevels.some((severity) => severityCounts[severity] > 0) ? (
          <SeverityTally severityCounts={severityCounts} />
        ) : null}

        <IssueList issues={visibleIssues} onIssueSelect={handleIssueSelect} />
      </PopoverContent>
    </Popover>
  );
}

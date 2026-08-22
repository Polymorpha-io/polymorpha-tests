import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";
import IssueList from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/components/IssueList";
import SeverityTally from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/components/SeverityTally";
import {
  getSeverityCounts,
  getVisibleIssues,
} from "@/components/CleaningPanel/components/HistoryControls/components/DetectedIssues/utils";

type IssuesDialogProps = {
  open: boolean;
  issues: readonly DetectedIssue[];
  onOpenChange: (open: boolean) => void;
  onIssueSelect: (step: CleanStepId) => void;
};

export function IssuesDialog({
  open,
  issues,
  onOpenChange,
  onIssueSelect,
}: IssuesDialogProps) {
  const severityCounts = getSeverityCounts(issues);
  const visibleIssues = getVisibleIssues(issues);

  function handleIssueSelect(step: CleanStepId) {
    onIssueSelect(step);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-lg p-4 md:max-w-[min(25rem,calc(100vw-2rem))]">
        <DialogTitle className="mb-3 text-sm font-bold tracking-wider text-muted-foreground uppercase">
          Detected issues
        </DialogTitle>
        <DialogDescription className="sr-only">
          Click an issue to navigate to the relevant cleaning step.
        </DialogDescription>
        <SeverityTally severityCounts={severityCounts} />
        <IssueList issues={visibleIssues} onIssueSelect={handleIssueSelect} />
      </DialogContent>
    </Dialog>
  );
}

import { RotateCcw, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useIsMobile } from "@/hooks/shadcn/use-mobile";
import { useIsTablet } from "@/hooks/shadcn/use-tablet";
import { MobileHistoryControls } from "@/components/CleaningPanel/components/HistoryControls/components/MobileHistoryControls";
import { IssuesPopover } from "@/components/CleaningPanel/components/HistoryControls/components/IssuesPopover";
import { ImpactPopover } from "@/components/CleaningPanel/components/HistoryControls/components/ImpactPopover";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";
import type { ImpactSummary } from "@/components/CleaningPanel/components/HistoryControls/types";

type HistoryControlsProps = {
  issues?: readonly DetectedIssue[];
  issuesDisabled?: boolean;
  onIssueSelect?: (step: CleanStepId) => void;
  impactCount?: number;
  impact: ImpactSummary;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onReset?: () => void;
};

export function HistoryControls({
  issues,
  issuesDisabled,
  onIssueSelect,
  impactCount,
  impact,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onReset,
}: HistoryControlsProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile || isTablet) {
    return (
      <MobileHistoryControls
        issues={issues}
        issuesDisabled={issuesDisabled}
        onIssueSelect={onIssueSelect}
        impactCount={impactCount}
        impact={impact}
        onUndo={onUndo}
        canUndo={canUndo}
        onRedo={onRedo}
        canRedo={canRedo}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1 dark:bg-card">
      <IssuesPopover
        issues={issues}
        issuesDisabled={issuesDisabled}
        onIssueSelect={onIssueSelect}
      />
      <ImpactPopover impact={impact} impactCount={impactCount} />
      <Button
        variant="outline"
        type="button"
        className="h-auto gap-1.5 py-1.5 dark:bg-card"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo last config change"
      >
        <Undo2 />
        Undo
      </Button>
      <Button
        variant="outline"
        type="button"
        className="h-auto gap-1.5 py-1.5 dark:bg-card"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <Redo2 />
        Redo
      </Button>
      <Button
        variant="outline"
        type="button"
        className="h-auto gap-1.5 py-1.5 dark:bg-card"
        onClick={onReset}
      >
        <RotateCcw />
        Reset
      </Button>
    </div>
  );
}

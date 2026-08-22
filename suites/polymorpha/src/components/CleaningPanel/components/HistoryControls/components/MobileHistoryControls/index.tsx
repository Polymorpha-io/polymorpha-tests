import { useState } from "react";
import {
  Gauge,
  MoreHorizontal,
  RotateCcw,
  Redo2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { IssuesDialog } from "@/components/CleaningPanel/components/HistoryControls/components/IssuesDialog";
import { ImpactDialog } from "@/components/CleaningPanel/components/HistoryControls/components/ImpactDialog";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";
import type { ImpactSummary } from "@/components/CleaningPanel/components/HistoryControls/types";

const itemHoverTint = "focus:bg-muted focus:text-foreground";

type MobileHistoryControlsProps = {
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

export function MobileHistoryControls({
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
}: MobileHistoryControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const [impactDialogOpen, setImpactDialogOpen] = useState(false);
  const issueCount = issues?.length ?? 0;

  function handleIssueSelect(step: CleanStepId) {
    setMenuOpen(false);
    onIssueSelect?.(step);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="size-10 dark:bg-card"
              aria-label="More actions"
            />
          }
        >
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56 rounded-lg p-1.5">
          <DropdownMenuItem
            className={itemHoverTint}
            disabled={issuesDisabled || !issueCount}
            aria-label={`Detected issues: ${issueCount} open`}
            onClick={() => {
              setMenuOpen(false);
              setIssuesDialogOpen(true);
            }}
          >
            <TriangleAlert />
            Issues
            {issueCount && !issuesDisabled ? (
              <Badge className="ml-auto rounded-[6px] bg-chart-2 font-mono text-primary-foreground!">
                {issueCount}
              </Badge>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemHoverTint}
            disabled={impact.items.length === 0}
            onClick={() => {
              setMenuOpen(false);
              setImpactDialogOpen(true);
            }}
          >
            <Gauge />
            Impact
            {impactCount ? (
              <Badge className="ml-auto rounded-[6px] bg-chart-2 font-mono text-primary-foreground!">
                {impactCount}
              </Badge>
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={itemHoverTint}
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2 />
            Undo
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemHoverTint}
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Redo2 />
            Redo
          </DropdownMenuItem>
          <DropdownMenuItem className={itemHoverTint} onClick={onReset}>
            <RotateCcw />
            Reset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <IssuesDialog
        open={issuesDialogOpen}
        issues={issues ?? []}
        onOpenChange={setIssuesDialogOpen}
        onIssueSelect={handleIssueSelect}
      />

      <ImpactDialog
        open={impactDialogOpen}
        impact={impact}
        onOpenChange={setImpactDialogOpen}
      />
    </>
  );
}

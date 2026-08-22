import { Table2, SlidersHorizontal } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { HistoryControls } from "@/components/CleaningPanel/components/HistoryControls";
import type {
  CleanStepId,
  DetectedIssue,
} from "@/components/CleaningPanel/types";
import type { ImpactSummary } from "@/components/CleaningPanel/components/HistoryControls/types";
import { TAB_ID } from "./constants";

const triggerClass =
  "h-auto min-h-8 flex-none gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-[color-mix(in_oklch,var(--background)_70%,var(--muted))] hover:text-foreground data-active:bg-background data-active:font-bold data-active:text-chart-2 data-active:shadow-sm dark:data-active:border-transparent dark:data-active:bg-muted dark:data-active:text-chart-2";

type TabBarProps = {
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

export function TabBar({
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
}: TabBarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <TabsList
        aria-label="Cleaning panel views"
        className="justify-start gap-0.5 rounded-lg border border-border px-1.5 py-1 dark:bg-card group-data-horizontal/tabs:h-auto!"
      >
        <TabsTrigger value={TAB_ID.data} className={triggerClass}>
          <Table2 className="h-4 w-4" />
          Data
        </TabsTrigger>
        <TabsTrigger value={TAB_ID.workflow} className={triggerClass}>
          <SlidersHorizontal className="h-4 w-4" />
          Processing
        </TabsTrigger>
      </TabsList>

      <HistoryControls
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
    </div>
  );
}

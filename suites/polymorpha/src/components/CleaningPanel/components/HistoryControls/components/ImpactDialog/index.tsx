import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Badge } from "@/components/shadcn/badge";
import { ImpactSummary } from "@/components/CleaningPanel/components/HistoryControls/components/ImpactSummary";
import type { ImpactSummary as ImpactSummaryData } from "@/components/CleaningPanel/components/HistoryControls/types";

type ImpactDialogProps = {
  open: boolean;
  impact: ImpactSummaryData;
  onOpenChange: (open: boolean) => void;
};

export function ImpactDialog({
  open,
  impact,
  onOpenChange,
}: ImpactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-lg p-4 md:max-w-[min(25rem,calc(100vw-2rem))]">
        <div className="mb-3 flex items-center gap-2">
          <DialogTitle className="text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Cleaning impact
          </DialogTitle>
          {impact.estimated ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-[6px] px-1.5 font-mono text-[10px] uppercase"
            >
              estimated
            </Badge>
          ) : null}
        </div>
        <DialogDescription className="sr-only">
          Summary of the changes made or estimated for the cleaned dataset.
        </DialogDescription>
        <ImpactSummary impact={impact} />
      </DialogContent>
    </Dialog>
  );
}

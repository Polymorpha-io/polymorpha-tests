import { useState } from "react";
import { Gauge } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { ImpactSummary } from "@/components/CleaningPanel/components/HistoryControls/components/ImpactSummary";
import type { ImpactSummary as ImpactSummaryData } from "@/components/CleaningPanel/components/HistoryControls/types";

type ImpactPopoverProps = {
  impact: ImpactSummaryData;
  impactCount?: number;
};

export function ImpactPopover({ impact, impactCount = 0 }: ImpactPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            type="button"
            className="h-auto gap-1.5 py-1.5 dark:bg-card"
            disabled={impact.items.length === 0}
            aria-label="Cleaning impact"
          />
        }
      >
        <Gauge data-icon="inline-start" />
        Impact
        {impactCount ? (
          <Badge className="h-4.5 min-w-4.5 rounded-[6px] bg-chart-2 px-1.5 font-mono text-[11px] font-bold text-primary-foreground">
            {impactCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        role="dialog"
        aria-label="Cleaning impact summary"
        className="w-90 max-w-[calc(100vw-2rem)] gap-0 rounded-lg border-border p-3"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <PopoverTitle className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Cleaning impact
          </PopoverTitle>
          {impact.estimated ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-[6px] px-1.5 font-mono text-[10px] uppercase"
            >
              estimated
            </Badge>
          ) : null}
        </div>
        <ImpactSummary impact={impact} />
      </PopoverContent>
    </Popover>
  );
}

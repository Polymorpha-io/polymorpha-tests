import { cn } from "@/lib/shadcn/utils";
import type { ImpactSummary as ImpactSummaryData } from "@/components/CleaningPanel/components/HistoryControls/types";

type ImpactSummaryProps = {
  impact: ImpactSummaryData;
};

export function ImpactSummary({ impact }: ImpactSummaryProps) {
  return (
    <div
      className="flex max-h-60 flex-col overflow-auto rounded-lg border border-border bg-background"
      aria-label="Cleaning impact summary"
    >
      {impact.items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0",
            index % 2 === 1 && "bg-muted",
          )}
        >
          <span className="min-w-0 flex-1 text-left text-[13px] leading-tight text-muted-foreground">
            {item.label}
            {item.detail ? (
              <span className="ml-1 text-xs">{item.detail}</span>
            ) : null}
          </span>
          {item.value ? (
            <strong className="flex-none font-mono text-sm leading-none text-foreground">
              {item.value}
            </strong>
          ) : null}
        </div>
      ))}
    </div>
  );
}

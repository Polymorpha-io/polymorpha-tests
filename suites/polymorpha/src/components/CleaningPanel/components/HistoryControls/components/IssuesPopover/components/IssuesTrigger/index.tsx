import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { PopoverTrigger } from "@/components/shadcn/popover";

type IssuesTriggerProps = {
  issueCount: number;
  disabled?: boolean;
};

export default function IssuesTrigger({
  issueCount,
  disabled = false,
}: IssuesTriggerProps) {
  return (
    <PopoverTrigger
      render={
        <Button
          variant="outline"
          type="button"
          className="h-auto gap-1.5 py-1.5 dark:bg-card"
          disabled={disabled || !issueCount}
          aria-label={`Detected issues: ${issueCount} open`}
        />
      }
    >
      <TriangleAlert data-icon="inline-start" />
      Issues
      {issueCount && !disabled ? (
        <Badge className="h-4.5 min-w-4.5 rounded-[6px] bg-chart-2 px-1.5 font-mono text-[11px] font-bold text-primary-foreground">
          {issueCount}
        </Badge>
      ) : null}
    </PopoverTrigger>
  );
}

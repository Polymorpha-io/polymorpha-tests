import { memo } from "react";
import { cn } from "@/lib/shadcn/utils";
import {
  ROW_NUMBER_COL_ID,
  ROW_NUMBER_HEADER,
} from "@/components/DataPreview/components/DataTable/constants";

interface HeaderCellProps {
  headerId: string;
  colIdx: number;
}

function HeaderCellImpl({ headerId, colIdx }: HeaderCellProps) {
  const isRowNumber = headerId === ROW_NUMBER_COL_ID;
  return (
    <div
      role="columnheader"
      aria-colindex={colIdx + 1}
      aria-rowindex={1}
      title={isRowNumber ? undefined : headerId}
      className={cn(
        "bg-background text-[11px] font-mono font-semibold px-4 py-2.75 shadow-[inset_0_-1px_0_var(--border)] min-w-0 uppercase tracking-wider",
        isRowNumber
          ? "sticky left-0 z-4 text-center text-muted-foreground/70 border-r-2"
          : "text-muted-foreground truncate",
      )}
    >
      {isRowNumber ? ROW_NUMBER_HEADER : headerId}
    </div>
  );
}

export const HeaderCell = memo(HeaderCellImpl);

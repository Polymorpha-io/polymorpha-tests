import { memo } from "react";
import { cn } from "@/lib/shadcn/utils";
import { EMPTY_CELL_TEXT } from "@/components/DataPreview/components/DataTable/constants";

interface DataCellProps {
  colIndex: number;
  isNumeric: boolean;
  val: unknown;
  rowIndex: number;
  isLastVisibleRow: boolean;
}

function DataCellImpl({
  colIndex,
  isNumeric,
  val,
  rowIndex,
  isLastVisibleRow,
}: DataCellProps) {
  const isEmpty = val === null || val === undefined || val === "";
  return (
    <div
      role="gridcell"
      aria-colindex={colIndex + 2}
      aria-rowindex={rowIndex + 2}
      style={{ gridColumn: colIndex + 2 }}
      className={cn(
        "px-4 py-2.75 border-b border-border text-sm text-foreground truncate group-hover:bg-muted align-middle min-w-0",
        isNumeric && "font-mono tabular-nums text-right",
        isEmpty && "italic text-muted-foreground",
        isLastVisibleRow && "border-b-0",
      )}
    >
      {isEmpty ? EMPTY_CELL_TEXT : String(val)}
    </div>
  );
}

export const DataCell = memo(DataCellImpl);

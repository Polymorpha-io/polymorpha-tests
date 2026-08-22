import { memo } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { Column } from "@/types";
import { Columns } from "@/constants/schema";
import { cn } from "@/lib/shadcn/utils";
import { ROW_ESTIMATE_PX } from "@/components/DataPreview/components/DataTable/constants";
import { DataCell } from "@/components/DataPreview/components/DataTable/components/DataCell";

interface RowProps {
  rowIndex: number;
  rowStart: number;
  row: Record<string, unknown>;
  isLastVisibleRow: boolean;
  columns: Column[];
  columnTypeMap: Map<string, string>;
  virtualCols: VirtualItem[];
  gridCols: string;
  totalWidth: number;
}

function RowImpl({
  rowIndex,
  rowStart,
  row,
  isLastVisibleRow,
  columns,
  columnTypeMap,
  virtualCols,
  gridCols,
  totalWidth,
}: RowProps) {
  const isAlt = rowIndex % 2 === 1;
  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      className={cn("grid absolute top-0 left-0 group", isAlt && "bg-muted")}
      style={{
        transform: `translateY(${rowStart}px)`,
        gridTemplateColumns: gridCols,
        width: totalWidth,
        height: ROW_ESTIMATE_PX,
      }}
    >
      <div
        role="gridcell"
        aria-colindex={1}
        aria-rowindex={rowIndex + 2}
        className={cn(
          "sticky left-0 z-2 bg-background min-w-13 text-center text-muted-foreground text-[11px] font-mono tabular-nums font-semibold px-4 py-2.75 border-r-2 border-b border-border group-hover:bg-muted align-middle",
          isAlt && "bg-muted",
          isLastVisibleRow && "border-b-0",
        )}
      >
        {rowIndex + 1}
      </div>

      {virtualCols.map((vCol) => {
        const col = columns[vCol.index];
        const isNumeric = columnTypeMap.get(col.name) === Columns.Numeric;
        const val = row[col.name];
        return (
          <DataCell
            key={vCol.key}
            colIndex={vCol.index}
            isNumeric={isNumeric}
            val={val}
            rowIndex={rowIndex}
            isLastVisibleRow={isLastVisibleRow}
          />
        );
      })}
    </div>
  );
}

export const Row = memo(RowImpl);

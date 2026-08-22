import type { Header } from "@tanstack/react-table";
import type { Column } from "@/types";
import { useDataTable } from "@/components/DataPreview/components/DataTable/hooks/useDataTable";
import { Row } from "@/components/DataPreview/components/DataTable/components/Row";
import { HeaderCell } from "@/components/DataPreview/components/DataTable/components/HeaderCell";
import { Footer } from "@/components/DataPreview/components/DataTable/components/Footer";

interface DataTableProps {
  columns?: Column[];
  rows?: Record<string, unknown>[];
  totalRowCount?: number | null;
}

export default function DataTable({ columns = [], rows = [], totalRowCount }: DataTableProps) {
  const {
    parentRef,
    displayRows,
    columnTypeMap,
    headerGroup,
    virtualRows,
    virtualCols,
    gridCols,
    totalWidth,
    totalHeight,
    lastRowIdx,
  } = useDataTable(columns, rows);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* ── Scroll container ── */}
      <div
        ref={parentRef}
        role="grid"
        aria-rowcount={displayRows.length + 1}
        aria-colcount={columns.length + 1}
        className="relative flex-1 min-h-0 overflow-auto scrollbar-thin [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {/* ── Header row ── */}
        <div
          role="row"
          aria-rowindex={1}
          className="sticky top-0 z-3 grid bg-background"
          style={{ gridTemplateColumns: gridCols, minWidth: totalWidth }}
        >
          {headerGroup.headers.map((header: Header<Record<string, unknown>, unknown>, colIdx: number) => (
            <HeaderCell key={header.id} headerId={header.id} colIdx={colIdx} />
          ))}
        </div>

        {/* ── Virtualized body ── */}
        <div
          className="relative"
          style={{
            height: totalHeight,
            minWidth: totalWidth,
          }}
        >
          {virtualRows.map((vRow) => {
            const row = displayRows[vRow.index];
            const isLastVisibleRow = vRow.index === lastRowIdx;
            return (
              <Row
                key={vRow.key}
                rowIndex={vRow.index}
                rowStart={vRow.start}
                row={row}
                isLastVisibleRow={isLastVisibleRow}
                columns={columns}
                columnTypeMap={columnTypeMap}
                virtualCols={virtualCols}
                gridCols={gridCols}
                totalWidth={totalWidth}
              />
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <Footer
        visibleCount={displayRows.length}
        totalCount={totalRowCount ?? rows.length}
      />
    </div>
  );
}

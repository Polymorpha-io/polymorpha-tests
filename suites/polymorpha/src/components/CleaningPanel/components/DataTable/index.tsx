import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { cn } from "@/lib/shadcn/utils";
import { Columns } from "@/constants/schema";
import {
  ROWS_PER_PAGE_OPTIONS,
  ROW_NUMBER_COL_ID,
  ROW_NUMBER_WIDTH_PX,
  SCROLLBAR_CLASS,
} from "./constants";
import { useDataTable } from "./useDataTable";
import type { DataTableProps } from "./types";

export function DataTable({ dataset, newColumnNames }: DataTableProps) {
  const {
    table,
    columnTypeMap,
    isEmptyValue,
    pageRangeLabel,
    pageSize,
    columnWidthStyle,
  } = useDataTable({ dataset });

  return (
    <div className="flex max-h-[80vh] min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card">
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto **:data-[slot=table-container]:overflow-x-visible",
          SCROLLBAR_CLASS,
        )}
      >
        <Table className="w-max">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const headerText = header.isPlaceholder
                    ? ""
                    : (header.column.columnDef.header as string);
                  const isRowNumber = header.column.id === ROW_NUMBER_COL_ID;
                  const widthStyle = columnWidthStyle(
                    columnTypeMap.get(header.column.id),
                  );
                  return (
                    <TableHead
                      key={header.id}
                      style={
                        isRowNumber
                          ? { width: ROW_NUMBER_WIDTH_PX }
                          : { minWidth: widthStyle.minWidth }
                      }
                      className={cn(
                        "sticky top-0 z-10 truncate border-r border-border bg-muted font-mono text-sm font-bold text-foreground",
                        isRowNumber && "text-center text-muted-foreground/70",
                      )}
                    >
                      {isRowNumber ? (
                        headerText
                      ) : (
                        <span
                          className="flex min-w-0 items-center gap-1.5"
                          style={{ maxWidth: widthStyle.maxWidth }}
                          title={headerText || undefined}
                        >
                          <span className="truncate">
                            {headerText}
                          </span>
                          {newColumnNames?.includes(headerText) && (
                            <Badge className="h-auto shrink-0 rounded-md border-primary/28 bg-primary/10 px-1.25 py-0.5 font-mono text-[10px] font-bold leading-none tracking-[0.04em] text-primary dark:border-chart-2/40 dark:bg-chart-2/15 dark:text-chart-2">
                              NEW
                            </Badge>
                          )}
                        </span>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="even:bg-muted/60 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {row.getVisibleCells().map((cell) => {
                    const value = cell.getValue();
                    const isRowNumber = cell.column.id === ROW_NUMBER_COL_ID;
                    const text = isEmptyValue(value) ? null : String(value);
                    const isNumeric =
                      columnTypeMap.get(cell.column.id) === Columns.Numeric;
                    const widthStyle = columnWidthStyle(
                      columnTypeMap.get(cell.column.id),
                    );
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "border-r border-border px-2 py-1.5",
                          isNumeric && "text-right font-mono",
                          isRowNumber &&
                            "text-center font-mono tabular-nums text-muted-foreground",
                        )}
                      >
                        {isRowNumber ? (
                          text
                        ) : (
                          <span
                            className={cn(
                              "block truncate",
                              text === null && "text-muted-foreground",
                            )}
                            style={{ maxWidth: widthStyle.maxWidth }}
                            title={text ?? undefined}
                          >
                            {text ?? "N/A"}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={dataset.columns.length + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No rows to display
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-muted px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Rows per page"
              className="font-mono text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROWS_PER_PAGE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm tabular-nums">
            {pageRangeLabel}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useRef, type RefObject } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  type HeaderGroup,
  type CellContext,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { Column } from "@/types";
import { Columns } from "@/constants/schema";
import { PREVIEW_LIMIT } from "@/components/DataPreview/constants";
import {
  CHAR_WIDTH_PX,
  HEADER_PADDING_PX,
  MIN_COL_WIDTH_STRINGY,
  MIN_COL_WIDTH_COMPACT,
  MAX_COL_WIDTH_PX,
  ROW_NUMBER_COL_ID,
  ROW_NUMBER_HEADER,
  ROW_NUMBER_WIDTH_PX,
  ROW_OVERSCAN,
  COL_OVERSCAN,
  ROW_ESTIMATE_PX,
} from "@/components/DataPreview/components/DataTable/constants";

const columnHelper = createColumnHelper<Record<string, unknown>>();

const estimateRowSize = () => ROW_ESTIMATE_PX;

function getColPx(col: Column): number {
  const minPx =
    col.type === Columns.Categorical || col.type === Columns.Unknown
      ? MIN_COL_WIDTH_STRINGY
      : MIN_COL_WIDTH_COMPACT;
  const namePx = col.name.length * CHAR_WIDTH_PX + HEADER_PADDING_PX;
  return Math.min(MAX_COL_WIDTH_PX, Math.max(minPx, namePx));
}

export interface UseDataTableResult {
  parentRef: RefObject<HTMLDivElement | null>;
  displayRows: Record<string, unknown>[];
  columnTypeMap: Map<string, string>;
  headerGroup: HeaderGroup<Record<string, unknown>>;
  virtualRows: VirtualItem[];
  virtualCols: VirtualItem[];
  gridCols: string;
  totalWidth: number;
  totalHeight: number;
  lastRowIdx: number;
}

export function useDataTable(
  columns: Column[],
  rows: Record<string, unknown>[],
): UseDataTableResult {
  const displayRows = useMemo(
    () => (rows.length > PREVIEW_LIMIT ? rows.slice(0, PREVIEW_LIMIT) : rows),
    [rows],
  );

  const columnTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const col of columns) {
      map.set(col.name, col.type);
    }
    return map;
  }, [columns]);

  const colPxs = useMemo(() => columns.map((col) => getColPx(col)), [columns]);

  const gridCols = useMemo(
    () => [ROW_NUMBER_WIDTH_PX, ...colPxs].map((px) => `${px}px`).join(" "),
    [colPxs],
  );

  const totalWidth = useMemo(
    () => ROW_NUMBER_WIDTH_PX + colPxs.reduce((a, b) => a + b, 0),
    [colPxs],
  );

  const tableColumns = useMemo(
    () => [
      columnHelper.display({
        id: ROW_NUMBER_COL_ID,
        header: ROW_NUMBER_HEADER,
        size: ROW_NUMBER_WIDTH_PX,
        cell: (info: CellContext<Record<string, unknown>, unknown>) => info.row.index + 1,
      }),
      ...columns.map((col) =>
        columnHelper.accessor(col.name, {
          header: col.name,
          size: getColPx(col),
        }),
      ),
    ],
    [columns],
  );

  const table = useReactTable({
    data: displayRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => parentRef.current, []);
  const estimateColSize = useCallback(
    (i: number) => colPxs[i] ?? ROW_NUMBER_WIDTH_PX,
    [colPxs],
  );

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement,
    estimateSize: estimateRowSize,
    overscan: ROW_OVERSCAN,
  });

  const columnVirtualizer = useVirtualizer({
    count: columns.length,
    getScrollElement,
    estimateSize: estimateColSize,
    overscan: COL_OVERSCAN,
    horizontal: true,
  });

  const headerGroup = table.getHeaderGroups()[0];
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();
  const lastRowIdx = virtualRows.length > 0 ? virtualRows.length - 1 : -1;
  const totalHeight = rowVirtualizer.getTotalSize();

  return {
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
  };
}

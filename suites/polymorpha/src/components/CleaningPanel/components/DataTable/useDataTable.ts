import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { Columns } from "@/constants/schema";
import type { Row } from "@/types";
import {
  MAX_COL_WIDTH,
  MAX_COL_WIDTH_NUMERIC,
  MIN_COL_WIDTH_COMPACT,
  MIN_COL_WIDTH_STRINGY,
  PAGE_SIZE,
  ROW_NUMBER_COL_ID,
  ROW_NUMBER_HEADER,
} from "./constants";
import type { DataTableProps } from "./types";

const columnHelper = createColumnHelper<Row>();

function columnWidthStyle(type: string | undefined) {
  const isNumeric = type === Columns.Numeric;
  return {
    minWidth: isNumeric ? MIN_COL_WIDTH_COMPACT : MIN_COL_WIDTH_STRINGY,
    maxWidth: isNumeric ? MAX_COL_WIDTH_NUMERIC : MAX_COL_WIDTH,
  };
}

export function useDataTable({ dataset }: DataTableProps) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor((_row, index) => index + 1, {
        id: ROW_NUMBER_COL_ID,
        header: ROW_NUMBER_HEADER,
      }),
      ...dataset.columns.map((column) =>
        columnHelper.accessor((row) => row[column.name], {
          id: column.name,
          header: column.name,
        }),
      ),
    ],
    [dataset.columns],
  );

  const columnTypeMap = useMemo(
    () => new Map(dataset.columns.map((c) => [c.name, c.type])),
    [dataset.columns],
  );

  const table = useReactTable({
    data: dataset.rows,
    columns: columns as ColumnDef<Row>[],
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const isEmptyValue = (value: unknown) =>
    value === null || value === undefined || value === "";

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getRowCount();
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = totalRows === 0 ? 0 : Math.min(start + pageSize - 1, totalRows);
  const pageRangeLabel = `${start.toLocaleString()}–${end.toLocaleString()} of ${totalRows.toLocaleString()}`;

  return {
    table,
    columnTypeMap,
    isEmptyValue,
    pageRangeLabel,
    pageSize,
    columnWidthStyle,
  };
}

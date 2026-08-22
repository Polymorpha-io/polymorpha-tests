import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileText } from "lucide-react";
import type { Column, ColumnType } from "@/types";
import { ColumnsAbbr } from "@/constants/schema";
import { ColumnsIcon } from "@/components/DataPreview/constants";
import { toColumnType } from "@/components/DataPreview/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/shadcn/sheet";
import { useIsMobile } from "@/hooks/shadcn/use-mobile";
import { useIsTablet } from "@/hooks/shadcn/use-tablet";

interface SchemaSidebarProps {
  fileName?: string;
  rowCount?: number;
  columns?: Column[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function SchemaSidebar({
  fileName = "Untitled Dataset",
  rowCount,
  columns = [],
  open,
  onOpenChange,
}: SchemaSidebarProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isMobileOrTablet = isMobile || isTablet;

  const [internalOpen, setInternalOpen] = useState(true);
  const sidebarOpen = open ?? internalOpen;
  const setSidebarOpen = onOpenChange ?? setInternalOpen;

  const displayName = fileName || "Untitled Dataset";
  const rowMeta = rowCount != null ? rowCount.toLocaleString() : "—";
  const colMeta = columns.length.toLocaleString();

  const countByType = useMemo(() => {
    const counts: Partial<Record<ColumnType, number>> = {};
    for (const _col of columns) {
      const safeType = toColumnType(_col.type);
      counts[safeType] = (counts[safeType] || 0) + 1;
    }
    return counts;
  }, [columns]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const renderFileHeader = useCallback(
    () => (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="font-mono text-base font-semibold text-foreground line-clamp-2 wrap-break-word">
            {displayName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground pl-6">
          {rowMeta} rows &middot; {colMeta} columns
        </p>
      </div>
    ),
    [displayName, rowMeta, colMeta],
  );

  const renderTypeBadges = useCallback(
    () =>
      Object.keys(countByType).length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-4 border-b border-border">
          {(Object.entries(countByType) as [ColumnType, number][]).map(
            ([type, count]) => {
              const Icon = ColumnsIcon[type];

              return (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 h-6 rounded text-xs font-medium bg-muted text-foreground"
                >
                  <Icon className="w-2.5 h-2.5" />
                  <span className="font-mono font-semibold">{count}</span>
                  <span>{type}</span>
                </span>
              );
            },
          )}
        </div>
      ) : null,
    [countByType],
  );

  const renderColumnList = useCallback(
    () => (
      <div
        className="relative w-full"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        {rowVirtualizer.getVirtualItems().map((vRow) => {
          const col = columns[vRow.index];
          const safeType = toColumnType(col.type);
          const Icon = ColumnsIcon[safeType];
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full flex items-start justify-between gap-3 px-2 py-2 rounded hover:bg-muted transition-colors cursor-pointer"
              style={{ transform: `translateY(${vRow.start}px)` }}
            >
              <span className="font-mono text-sm text-foreground truncate">
                {col.name}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted shrink-0">
                <Icon className="w-2.5 h-2.5" />
                {ColumnsAbbr[safeType]}
              </span>
            </div>
          );
        })}
      </div>
    ),
    [columns, rowVirtualizer],
  );

  const renderColumnsHeading = useCallback(
    () => (
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Columns
        </p>
      </div>
    ),
    [],
  );

  if (isMobileOrTablet) {
    return (
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="w-80! p-0 gap-0">
          <SheetHeader>
            <SheetTitle>Columns overview</SheetTitle>
          </SheetHeader>
          {sidebarOpen && (
            <div
              ref={parentRef}
              className="flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground [&::-webkit-scrollbar-track]:bg-transparent"
            >
              <div className="p-5">
                {renderFileHeader()}
                {renderTypeBadges()}
                {renderColumnsHeading()}
                {renderColumnList()}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="w-80 bg-background border-r border-border shrink-0 flex flex-col"
      aria-label="Columns overview"
    >
      <div className="p-5 pb-2 shrink-0">
        {renderFileHeader()}
        {renderTypeBadges()}
        {renderColumnsHeading()}
      </div>
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 scrollbar-thin [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {renderColumnList()}
      </div>
    </aside>
  );
}

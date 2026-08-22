import type { RefObject } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { CleaningDiff, Column, CleaningConfig } from "@/types";

export interface DataModellerTableProps {
  parentRef: RefObject<HTMLDivElement | null>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  gridCols: string;
  totalWidth: number;
  orderedColumns: Column[];
  displayRows: Record<string, unknown>[];
  isPreviewMode: boolean;
  rawSampleRows: Record<string, unknown>[] | null;
  cleanDiff: CleaningDiff | null;
  cleaningConfig: CleaningConfig | null;
}

export function DataModellerTable({
  parentRef,
  rowVirtualizer,
  gridCols,
  totalWidth,
  orderedColumns,
  displayRows,
  isPreviewMode,
  rawSampleRows,
  cleanDiff,
  cleaningConfig,
}: DataModellerTableProps) {
  return (
    <div className="vtable-scroll" ref={parentRef}>
      {/* Sticky header — same grid as every data row */}
      <div
        className="vtable-header"
        style={{
          gridTemplateColumns: gridCols,
          minWidth: totalWidth,
        }}
      >
        <div className="vtable-th vtable-th--row-num">#</div>
        {orderedColumns.map((col) => (
          <div key={col.name} className="vtable-th" title={col.name}>
            {col.name}
          </div>
        ))}
      </div>

      {/* Virtual body spacer */}
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          minWidth: totalWidth,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.index}
            className={`vtable-row${vRow.index % 2 === 1 ? " vtable-row--alt" : ""}`}
            style={{
              gridTemplateColumns: gridCols,
              transform: `translateY(${vRow.start}px)`,
              width: totalWidth,
            }}
          >
            <div className="vtable-td vtable-td--row-num">{vRow.index + 1}</div>
            {orderedColumns.map((col) => {
              const val = displayRows[vRow.index][col.name];
              const isEmpty = val === null || val === undefined || val === "";
              // Highlight cells that differ from raw (imputed/changed values)
              const rawVal =
                isPreviewMode && rawSampleRows
                  ? rawSampleRows[vRow.index]?.[col.name]
                  : undefined;
              const isChanged =
                isPreviewMode &&
                rawSampleRows &&
                rawVal !== undefined &&
                rawVal !== val;
              const wasEmpty =
                rawVal === null || rawVal === undefined || rawVal === "";
              // Determine specific change type for color coding
              const isRemoved =
                isPreviewMode &&
                cleaningConfig?.removeColumns.includes(col.name);
              const isNewCol =
                isPreviewMode && cleanDiff?.columnsAdded?.includes(col.name);
              const isOutlier =
                isPreviewMode &&
                isChanged &&
                (cleanDiff?.outliersHandled?.[col.name] ?? 0) > 0 &&
                !wasEmpty;
              const isImputed = isChanged && wasEmpty;
              let cellClass = "vtable-td";
              if (isEmpty) cellClass += " vtable-td--empty";
              if (isRemoved) cellClass += " vtable-td--removed";
              else if (isNewCol) cellClass += " vtable-td--new-col";
              else if (isImputed) cellClass += " vtable-td--imputed";
              else if (isOutlier) cellClass += " vtable-td--outlier";
              else if (isChanged) cellClass += " vtable-td--changed";
              return (
                <div key={col.name} className={cellClass}>
                  {isEmpty ? "N/A" : String(val)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

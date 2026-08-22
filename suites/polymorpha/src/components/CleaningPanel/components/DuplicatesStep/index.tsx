import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type DuplicateLiveCount = {
  count: number;
  total: number;
} | null;

export type DuplicatesStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  duplicateLiveCount: DuplicateLiveCount;
};

export function DuplicatesStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
  duplicateLiveCount,
}: DuplicatesStepProps) {
  return (
    <div className="clean-step-panel">
      <h3>Duplicates</h3>
      <p className="clean-hint-line">
        Choose whether duplicates are checked across the full row or a custom
        key subset.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.duplicates} />}
      <label className="checkbox-label clean-inline-check">
        <input
          type="checkbox"
          checked={cleaningConfig.duplicates.enabled}
          onChange={(e) =>
            updateConfig({
              ...cleaningConfig,
              duplicates: {
                ...cleaningConfig.duplicates,
                enabled: e.target.checked,
              },
            })
          }
        />
        Remove duplicate rows
      </label>
      <div className="col-checkboxes col-checkboxes--scroll">
        {raw.columns.map((column) => (
          <label key={column.name} className="checkbox-label">
            <input
              type="checkbox"
              checked={cleaningConfig.duplicates.subsetColumns.includes(
                column.name,
              )}
              onChange={(e) =>
                updateConfig({
                  ...cleaningConfig,
                  duplicates: {
                    ...cleaningConfig.duplicates,
                    subsetColumns: e.target.checked
                      ? [
                          ...cleaningConfig.duplicates.subsetColumns,
                          column.name,
                        ]
                      : cleaningConfig.duplicates.subsetColumns.filter(
                          (name) => name !== column.name,
                        ),
                  },
                })
              }
            />
            {column.name}
          </label>
        ))}
      </div>
      {duplicateLiveCount && (
        <div className="clean-live-stat clean-live-stat--duplicates">
          <strong>{duplicateLiveCount.count}</strong> duplicate rows found (
          {(
            (duplicateLiveCount.count / duplicateLiveCount.total) *
            100
          ).toFixed(1)}
          % of {duplicateLiveCount.total} rows will be removed)
        </div>
      )}
      {footer}
    </div>
  );
}

import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import { TYPE_LABEL } from "@/components/CleaningPanel/constants";
import { recommendedMissingStrategy } from "@/components/CleaningPanel/utils";
import "@/components/CleaningPanel/CleaningPanel.css";
import type {
  CleaningConfig,
  Column,
  Dataset,
  MissingConfig,
  MissingStrategy,
} from "@/types";

export type MissingColumnEntry = {
  column: Column;
  missing: number;
  strategy: string;
  severity: "none" | "low" | "medium" | "high";
  hasAttention: boolean;
};

export type MissingFillPreview = {
  label: string;
  value: string;
  nonMissing: number;
} | null;

export type MissingStepProps = {
  raw: Dataset;
  cleaned: Dataset | null;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  configured: boolean;
  showResolvedMissing: boolean;
  onToggleShowResolved: () => void;
  visibleMissingColumns: MissingColumnEntry[];
  highAttentionMissing: number;
  activeMissingColumn: MissingColumnEntry | null;
  activeMissingColumnName: string;
  onFocusColumn: (columnName: string) => void;
  missingFillPreview: MissingFillPreview;
};

export function MissingStep({
  raw,
  cleaned,
  cleaningConfig,
  updateConfig,
  footer,
  configured,
  showResolvedMissing,
  onToggleShowResolved,
  visibleMissingColumns,
  highAttentionMissing,
  activeMissingColumn,
  activeMissingColumnName,
  onFocusColumn,
  missingFillPreview,
}: MissingStepProps) {
  const updateMissing = (
    columnName: string,
    partial: Partial<MissingConfig>,
  ) => {
    updateConfig({
      ...cleaningConfig,
      missing: {
        ...cleaningConfig.missing,
        [columnName]: {
          ...cleaningConfig.missing[columnName],
          ...partial,
        },
      },
    });
  };

  return (
    <div className="clean-step-panel">
      <div className="clean-step-head">
        <h3>Missing values</h3>
        {configured && (
          <button
            className="btn-ghost btn-xs clean-step-reset"
            onClick={() => {
              const resetMissing = { ...cleaningConfig.missing };
              for (const key of Object.keys(resetMissing))
                resetMissing[key] = {
                  strategy: "none",
                  constantValue: "",
                  addIndicator: false,
                };
              updateConfig({
                ...cleaningConfig,
                missing: resetMissing,
              });
            }}
          >
            Reset step
          </button>
        )}
      </div>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.missing} />}
      <div className="clean-section-toolbar">
        <p className="clean-hint-line">
          Columns sorted by missingness. Numeric fields usually suit mean or
          median.
        </p>
        <button className="btn-ghost btn-sm" onClick={onToggleShowResolved}>
          {showResolvedMissing
            ? "Hide zero-missing"
            : `Show all (${raw.columns.length})`}
        </button>
      </div>
      <div className="clean-inline-summary">
        <span className="clean-summary-pill clean-summary-pill--alert">
          Needs attention: {highAttentionMissing}
        </span>
        <span className="clean-summary-pill">
          Zero missing hidden:{" "}
          {raw.columns.length - visibleMissingColumns.length}
        </span>
      </div>
      {activeMissingColumn ? (
        <div className="clean-focus-panel">
          <div className="clean-focus-toolbar">
            <label className="clean-focus-field">
              Column
              <select
                className="clean-select"
                value={activeMissingColumnName}
                onChange={(e) => onFocusColumn(e.target.value)}
              >
                {visibleMissingColumns.map((entry) => (
                  <option key={entry.column.name} value={entry.column.name}>
                    {entry.column.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="clean-focus-chips">
              {visibleMissingColumns.slice(0, 8).map((entry) => (
                <button
                  key={entry.column.name}
                  className={`clean-focus-chip${entry.column.name === activeMissingColumnName ? " is-active" : ""}`}
                  onClick={() => onFocusColumn(entry.column.name)}
                >
                  {entry.column.name}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`clean-option-card clean-option-card--missing-${activeMissingColumn.severity}`}
          >
            {(() => {
              const missingCfg =
                cleaningConfig.missing[activeMissingColumn.column.name];
              return (
                <>
                  <div className="clean-option-head">
                    <span className="clean-col-name">
                      {activeMissingColumn.column.name}
                      <span
                        className={`col-type-tag col-type-${activeMissingColumn.column.type}`}
                      >
                        {TYPE_LABEL[activeMissingColumn.column.type] ?? "?"}
                      </span>
                    </span>
                    <span
                      className={`clean-missing-badge clean-missing-badge--${activeMissingColumn.severity}`}
                    >
                      {activeMissingColumn.missing} missing
                    </span>
                  </div>
                  <p className="clean-option-guidance">
                    {recommendedMissingStrategy(
                      activeMissingColumn.column.type,
                      activeMissingColumn.missing,
                    )}
                  </p>
                  <div className="clean-option-grid">
                    <label>
                      Strategy
                      <select
                        className="clean-select"
                        value={missingCfg?.strategy ?? "none"}
                        onChange={(e) =>
                          updateMissing(activeMissingColumn.column.name, {
                            strategy: e.target.value as MissingStrategy,
                          })
                        }
                      >
                        <option value="none">No action</option>
                        <option value="drop">Drop row</option>
                        {activeMissingColumn.column.type === "numeric" && (
                          <>
                            <option value="mean">Mean</option>
                            <option value="median">Median</option>
                            <option value="mode">Mode</option>
                          </>
                        )}
                        <option value="constant">Constant value</option>
                        <option value="ffill">Forward fill</option>
                        <option value="bfill">Backward fill</option>
                      </select>
                    </label>
                    {missingCfg?.strategy === "constant" && (
                      <label>
                        Constant value
                        <input
                          className="clean-input"
                          value={missingCfg.constantValue ?? ""}
                          onChange={(e) =>
                            updateMissing(activeMissingColumn.column.name, {
                              constantValue: e.target.value,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <label className="checkbox-label clean-inline-check">
                    <input
                      type="checkbox"
                      checked={missingCfg?.addIndicator ?? false}
                      onChange={(e) =>
                        updateMissing(activeMissingColumn.column.name, {
                          addIndicator: e.target.checked,
                        })
                      }
                    />
                    Add `{activeMissingColumn.column.name}
                    _was_imputed` indicator column
                  </label>
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="clean-empty-state">
          <strong>No missing-value columns need attention.</strong>
        </div>
      )}
      {missingFillPreview && (
        <div className="clean-live-stat">
          Proposed fill value: <strong>{missingFillPreview.value}</strong> (
          {missingFillPreview.label}, computed from{" "}
          {missingFillPreview.nonMissing} non-missing rows)
        </div>
      )}
      {/* Inline column strip for the focused missing column */}
      {activeMissingColumnName && cleaned && (
        <div className="clean-live-strip clean-live-strip--inline">
          <div className="clean-live-strip-header">
            <span className="clean-live-strip-title">
              Column: {activeMissingColumnName}
            </span>
            <span className="clean-live-strip-meta">showing first 5 rows</span>
          </div>
          <div className="clean-live-strip-table-wrap">
            <table className="clean-live-strip-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Raw</th>
                  <th>Cleaned</th>
                </tr>
              </thead>
              <tbody>
                {raw.rows.slice(0, 5).map((rawRow, ri) => {
                  const rawVal = rawRow[activeMissingColumnName];
                  const cleanedVal =
                    cleaned.rows[ri]?.[activeMissingColumnName];
                  const wasMissing =
                    rawVal === null || rawVal === undefined || rawVal === "";
                  const changed = rawVal !== cleanedVal;
                  let cls = "";
                  if (wasMissing && changed) {
                    cls = "clean-live-strip-replaced";
                  } else if (changed) {
                    cls = "clean-live-strip-transformed";
                  } else if (wasMissing) {
                    cls = "clean-live-strip-affected";
                  }
                  return (
                    <tr key={ri}>
                      <td>{ri + 1}</td>
                      <td
                        className={
                          wasMissing ? "clean-live-strip-affected" : ""
                        }
                      >
                        {wasMissing ? "∅" : String(rawVal).slice(0, 12)}
                      </td>
                      <td className={cls}>
                        {cleanedVal === null ||
                        cleanedVal === undefined ||
                        cleanedVal === ""
                          ? "∅"
                          : String(cleanedVal).slice(0, 12)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {footer}
    </div>
  );
}

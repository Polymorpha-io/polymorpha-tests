import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type {
  CleaningConfig,
  Column,
  Dataset,
  OutlierAction,
  OutlierMethod,
} from "@/types";

export type OutlierLiveCount = {
  count: number;
  total: number;
  lower: number;
  upper: number;
} | null;

export type OutlierStepProps = {
  raw: Dataset;
  cleaned: Dataset | null;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  configured: boolean;
  outlierColumns: Column[];
  skippedOutlierColumns: Column[];
  activeOutlierColumn: Column | null;
  activeOutlierColumnName: string;
  onFocusColumn: (columnName: string) => void;
  outlierLiveCount: OutlierLiveCount;
};

export function OutlierStep({
  raw,
  cleaned,
  cleaningConfig,
  updateConfig,
  footer,
  configured,
  outlierColumns,
  skippedOutlierColumns,
  activeOutlierColumn,
  activeOutlierColumnName,
  onFocusColumn,
  outlierLiveCount,
}: OutlierStepProps) {
  const updateOutlier = (
    columnName: string,
    partial: Partial<CleaningConfig["outliers"][string]>,
  ) => {
    updateConfig({
      ...cleaningConfig,
      outliers: {
        ...cleaningConfig.outliers,
        [columnName]: {
          ...cleaningConfig.outliers[columnName],
          ...partial,
        },
      },
    });
  };

  return (
    <div className="clean-step-panel">
      <div className="clean-step-head">
        <h3>Outliers</h3>
        {configured && (
          <button
            className="btn-ghost btn-xs clean-step-reset"
            onClick={() => {
              const resetOutliers = { ...cleaningConfig.outliers };
              for (const key of Object.keys(resetOutliers))
                resetOutliers[key] = {
                  ...resetOutliers[key],
                  method: "none",
                };
              updateConfig({
                ...cleaningConfig,
                outliers: resetOutliers,
              });
            }}
          >
            Reset step
          </button>
        )}
      </div>
      <p className="clean-hint-line">
        Configure IQR, z-score, percentile clipping, or manual numeric cutoffs
        per column.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.outliers} />}
      {skippedOutlierColumns.length > 0 && (
        <div className="clean-inline-summary">
          <span className="clean-summary-pill">
            Skipped likely IDs:{" "}
            {skippedOutlierColumns.map((column) => column.name).join(", ")}
          </span>
        </div>
      )}
      {activeOutlierColumn ? (
        <div className="clean-focus-panel">
          <div className="clean-focus-toolbar">
            <label className="clean-focus-field">
              Numeric column
              <select
                className="clean-select"
                value={activeOutlierColumnName}
                onChange={(e) => onFocusColumn(e.target.value)}
              >
                {outlierColumns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="clean-focus-chips">
              {outlierColumns.slice(0, 8).map((column) => (
                <button
                  key={column.name}
                  className={`clean-focus-chip${column.name === activeOutlierColumnName ? " is-active" : ""}`}
                  onClick={() => onFocusColumn(column.name)}
                >
                  {column.name}
                </button>
              ))}
            </div>
          </div>
          <div className="clean-option-card">
            {(() => {
              const outlierCfg =
                cleaningConfig.outliers[activeOutlierColumn.name];
              return (
                <>
                  <div className="clean-option-head">
                    <span className="clean-col-name">
                      {activeOutlierColumn.name}
                      <span className="col-type-tag col-type-numeric">NUM</span>
                    </span>
                  </div>
                  <div className="clean-option-grid clean-option-grid--triple">
                    <label>
                      Method
                      <select
                        className="clean-select"
                        value={outlierCfg.method}
                        onChange={(e) =>
                          updateOutlier(activeOutlierColumn.name, {
                            method: e.target.value as OutlierMethod,
                          })
                        }
                      >
                        <option value="none">None</option>
                        <option value="iqr">IQR fence</option>
                        <option value="zscore">Z-score</option>
                        <option value="percentile">Percentile clip</option>
                        <option value="manual">Manual min/max</option>
                      </select>
                    </label>
                    <label>
                      Action
                      <select
                        className="clean-select"
                        value={outlierCfg.action}
                        disabled={outlierCfg.method === "none"}
                        onChange={(e) =>
                          updateOutlier(activeOutlierColumn.name, {
                            action: e.target.value as OutlierAction,
                          })
                        }
                      >
                        <option value="flag">Flag</option>
                        <option value="winsorize">Winsorize</option>
                        <option value="remove">Remove row</option>
                        <option value="nullify">Set to missing</option>
                      </select>
                    </label>
                    {outlierCfg.method === "zscore" && (
                      <label>
                        Z threshold
                        <input
                          className="clean-input"
                          type="number"
                          step="0.1"
                          value={outlierCfg.zThreshold ?? 3}
                          onChange={(e) =>
                            updateOutlier(activeOutlierColumn.name, {
                              zThreshold: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    {outlierCfg.method === "percentile" && (
                      <>
                        <label>
                          Lower %
                          <input
                            className="clean-input"
                            type="number"
                            min={0}
                            max={50}
                            value={outlierCfg.percentileLower ?? 1}
                            onChange={(e) =>
                              updateOutlier(activeOutlierColumn.name, {
                                percentileLower: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Upper %
                          <input
                            className="clean-input"
                            type="number"
                            min={50}
                            max={100}
                            value={outlierCfg.percentileUpper ?? 99}
                            onChange={(e) =>
                              updateOutlier(activeOutlierColumn.name, {
                                percentileUpper: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                    {outlierCfg.method === "manual" && (
                      <>
                        <label>
                          Manual lower
                          <input
                            className="clean-input"
                            type="number"
                            value={outlierCfg.manualLower ?? ""}
                            onChange={(e) =>
                              updateOutlier(activeOutlierColumn.name, {
                                manualLower:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Manual upper
                          <input
                            className="clean-input"
                            type="number"
                            value={outlierCfg.manualUpper ?? ""}
                            onChange={(e) =>
                              updateOutlier(activeOutlierColumn.name, {
                                manualUpper:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="clean-empty-state">
          <strong>No outlier candidates available.</strong>
        </div>
      )}
      {outlierLiveCount && (
        <div className="clean-live-stat clean-live-stat--outlier">
          <strong>{outlierLiveCount.count}</strong> outliers detected (
          {((outlierLiveCount.count / outlierLiveCount.total) * 100).toFixed(1)}
          % of {outlierLiveCount.total} values)
          <span className="clean-live-stat-detail">
            Bounds: [{outlierLiveCount.lower.toFixed(2)},{" "}
            {outlierLiveCount.upper.toFixed(2)}]
          </span>
        </div>
      )}
      {/* Inline column strip for the focused outlier column */}
      {activeOutlierColumnName && cleaned && (
        <div className="clean-live-strip clean-live-strip--inline">
          <div className="clean-live-strip-header">
            <span className="clean-live-strip-title">
              Column: {activeOutlierColumnName}
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
                  const rawVal = rawRow[activeOutlierColumnName];
                  const cleanedVal =
                    cleaned.rows[ri]?.[activeOutlierColumnName];
                  const changed = rawVal !== cleanedVal;
                  let cls = "";
                  if (changed && cleanedVal === null) {
                    cls = "clean-live-strip-removed";
                  } else if (changed) {
                    cls = "clean-live-strip-transformed";
                  }
                  return (
                    <tr key={ri}>
                      <td>{ri + 1}</td>
                      <td>
                        {rawVal === null || rawVal === undefined
                          ? "∅"
                          : String(rawVal).slice(0, 12)}
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

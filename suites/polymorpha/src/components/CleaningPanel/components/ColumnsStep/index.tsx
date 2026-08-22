import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import { TYPE_LABEL } from "@/components/CleaningPanel/constants";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset, ScaleMethod } from "@/types";

export type ColumnsStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  activeColumn: Dataset["columns"][number] | null;
  activeColumnFocusName: string;
  onFocusColumn: (columnName: string) => void;
};

export function ColumnsStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
  activeColumn,
  activeColumnFocusName,
  onFocusColumn,
}: ColumnsStepProps) {
  const effectiveType = (columnName: string) =>
    cleaningConfig.typeOverrides.find(
      (override) => override.columnName === columnName,
    )?.type ??
    raw.columns.find((column) => column.name === columnName)?.type ??
    "unknown";

  const updateScale = (
    columnName: string,
    partial: Partial<CleaningConfig["scaling"][string]>,
  ) => {
    updateConfig({
      ...cleaningConfig,
      scaling: {
        ...cleaningConfig.scaling,
        [columnName]: {
          ...cleaningConfig.scaling[columnName],
          ...partial,
        },
      },
    });
  };

  const setTypeOverride = (
    columnName: string,
    type: Dataset["columns"][number]["type"],
  ) => {
    const nextOverrides = cleaningConfig.typeOverrides.filter(
      (override) => override.columnName !== columnName,
    );
    const original =
      raw.columns.find((column) => column.name === columnName)?.detectedType ??
      "unknown";
    if (type !== original) {
      nextOverrides.push({ columnName, type });
    }
    updateConfig({ ...cleaningConfig, typeOverrides: nextOverrides });
  };

  const updateRename = (columnName: string, to: string) => {
    updateConfig({
      ...cleaningConfig,
      renameColumns: cleaningConfig.renameColumns.map((rule) =>
        rule.from === columnName ? { ...rule, to } : rule,
      ),
    });
  };

  const toggleRemovedColumn = (columnName: string, checked: boolean) => {
    updateConfig({
      ...cleaningConfig,
      removeColumns: checked
        ? [...cleaningConfig.removeColumns, columnName]
        : cleaningConfig.removeColumns.filter((name) => name !== columnName),
    });
  };

  return (
    <div className="clean-step-panel">
      <h3>Columns & rename</h3>
      <p className="clean-hint-line">
        Rename columns, change types, remove fields, and configure scaling.
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.columns.headers}
          before={EXAMPLES.columns.before}
          after={EXAMPLES.columns.after}
          afterHeaders={EXAMPLES.columns.afterHeaders}
          captionBefore={EXAMPLES.columns.captionBefore}
          captionAfter={EXAMPLES.columns.captionAfter}
        />
      )}
      <label className="checkbox-label clean-inline-check">
        <input
          type="checkbox"
          checked={cleaningConfig.trimColumnNames}
          onChange={(e) =>
            updateConfig({
              ...cleaningConfig,
              trimColumnNames: e.target.checked,
            })
          }
        />
        Trim leading/trailing spaces from all column names
      </label>
      {activeColumn && (
        <div className="clean-focus-panel">
          <div className="clean-focus-toolbar">
            <label className="clean-focus-field">
              Choose a column
              <select
                className="clean-select"
                value={activeColumnFocusName}
                onChange={(e) => onFocusColumn(e.target.value)}
              >
                {raw.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="clean-option-card">
            <div className="clean-option-head">
              <span className="clean-col-name">
                {activeColumn.name}
                <span className={`col-type-tag col-type-${activeColumn.type}`}>
                  {TYPE_LABEL[activeColumn.type] ?? "?"}
                </span>
              </span>
            </div>
            <div className="clean-option-grid clean-option-grid--triple">
              <label>
                Detected type
                <input
                  className="clean-input"
                  value={activeColumn.detectedType}
                  disabled
                />
              </label>
              <label>
                Current type
                <select
                  className="clean-select"
                  value={effectiveType(activeColumn.name)}
                  onChange={(e) =>
                    setTypeOverride(
                      activeColumn.name,
                      e.target.value as Dataset["columns"][number]["type"],
                    )
                  }
                >
                  <option value="numeric">numeric</option>
                  <option value="categorical">categorical</option>
                  <option value="date">date</option>
                  <option value="boolean">boolean</option>
                  <option value="unknown">unknown</option>
                </select>
              </label>
              <label>
                Rename to
                <input
                  className="clean-input"
                  value={
                    cleaningConfig.renameColumns.find(
                      (rule) => rule.from === activeColumn.name,
                    )?.to ?? activeColumn.name
                  }
                  onChange={(e) =>
                    updateRename(activeColumn.name, e.target.value)
                  }
                />
              </label>
              <label>
                Scaling
                {activeColumn.type === "numeric" ? (
                  <select
                    className="clean-select"
                    value={
                      cleaningConfig.scaling[activeColumn.name]?.method ??
                      "none"
                    }
                    onChange={(e) =>
                      updateScale(activeColumn.name, {
                        method: e.target.value as ScaleMethod,
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="minmax">Min-max</option>
                    <option value="zscore">Z-score</option>
                    <option value="robust">Robust</option>
                  </select>
                ) : (
                  <input className="clean-input" value="Not numeric" disabled />
                )}
              </label>
              {activeColumn.type === "numeric" &&
                (cleaningConfig.scaling[activeColumn.name]?.method ??
                  "none") === "minmax" && (
                  <>
                    <label>
                      Output min
                      <input
                        className="clean-input"
                        type="number"
                        value={
                          cleaningConfig.scaling[activeColumn.name]
                            ?.outputMin ?? 0
                        }
                        onChange={(e) =>
                          updateScale(activeColumn.name, {
                            outputMin: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Output max
                      <input
                        className="clean-input"
                        type="number"
                        value={
                          cleaningConfig.scaling[activeColumn.name]
                            ?.outputMax ?? 1
                        }
                        onChange={(e) =>
                          updateScale(activeColumn.name, {
                            outputMax: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </>
                )}
            </div>
            <label className="checkbox-label clean-inline-check">
              <input
                type="checkbox"
                checked={cleaningConfig.removeColumns.includes(
                  activeColumn.name,
                )}
                onChange={(e) =>
                  toggleRemovedColumn(activeColumn.name, e.target.checked)
                }
              />
              Remove this column from the processed dataset
            </label>
          </div>
        </div>
      )}
      {footer}
    </div>
  );
}

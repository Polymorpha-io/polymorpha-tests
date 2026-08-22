import type { ReactNode } from "react";
import { BeforeAfter } from "@/components/CleaningPanel/BeforeAfter";
import { FILTER_OPERATORS } from "@/components/CleaningPanel/constants";
import type { CleaningConfig, Dataset, RowFilterOperator } from "@/types";
import "@/components/CleaningPanel/CleaningPanel.css";

export type RowGateWarning = { rows: number; pct: number } | null;

export type RowGateStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
  rowGateWarning: RowGateWarning;
  configured: boolean;
};

export function RowGateStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
  rowGateWarning,
  configured,
}: RowGateStepProps) {
  return (
    <div className="clean-step-panel">
      <div className="clean-step-head">
        <h3>Row gate</h3>
        {configured && (
          <button
            className="btn-ghost btn-xs clean-step-reset"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                missingRowThresholdPct: null,
                rowFilter: {
                  ...cleaningConfig.rowFilter,
                  enabled: false,
                },
              })
            }
          >
            Reset step
          </button>
        )}
      </div>
      <p className="clean-hint-line">
        Trim the dataset before the heavier per-column work runs.
      </p>
      {rowGateWarning && (
        <div className="clean-inline-warning">
          This threshold will remove ~{rowGateWarning.rows} rows (
          {rowGateWarning.pct.toFixed(1)}% of your data)
        </div>
      )}
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={["id", "age", "city"]}
          before={[
            { id: "1", age: "29", city: "NYC" },
            { id: "2", age: "—", city: "—" },
            { id: "3", age: "44", city: "LA" },
            { id: "4", age: "—", city: "—" },
            { id: "5", age: "31", city: "NYC" },
          ]}
          after={[
            { id: "1", age: "29", city: "NYC" },
            { id: "3", age: "44", city: "LA" },
            { id: "5", age: "31", city: "NYC" },
          ]}
          struck={[1, 3]}
          captionBefore="5 rows · 2 mostly empty"
          captionAfter="3 rows · threshold 50% removed empty rows"
        />
      )}
      <div className="clean-row-gate-layout">
        <div className="clean-row-gate-threshold">
          <label>
            Missing row threshold %
            <input
              className="clean-input"
              type="number"
              min={0}
              max={100}
              value={cleaningConfig.missingRowThresholdPct ?? ""}
              placeholder="Disabled"
              onChange={(e) =>
                updateConfig({
                  ...cleaningConfig,
                  missingRowThresholdPct:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <fieldset className="clean-row-gate-filter">
          <legend className="clean-fieldset-legend">Row filter</legend>
          <div className="clean-inline-grid">
            <label>
              Column
              <select
                className="clean-select"
                value={cleaningConfig.rowFilter.column}
                onChange={(e) =>
                  updateConfig({
                    ...cleaningConfig,
                    rowFilter: {
                      ...cleaningConfig.rowFilter,
                      column: e.target.value,
                    },
                  })
                }
              >
                {raw.columns.map((column) => (
                  <option key={column.name} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Operator
              <select
                className="clean-select"
                value={cleaningConfig.rowFilter.operator}
                onChange={(e) =>
                  updateConfig({
                    ...cleaningConfig,
                    rowFilter: {
                      ...cleaningConfig.rowFilter,
                      operator: e.target.value as RowFilterOperator,
                    },
                  })
                }
              >
                {FILTER_OPERATORS.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Value
              <input
                className="clean-input"
                value={cleaningConfig.rowFilter.value}
                disabled={
                  cleaningConfig.rowFilter.operator === "isEmpty" ||
                  cleaningConfig.rowFilter.operator === "notEmpty"
                }
                onChange={(e) =>
                  updateConfig({
                    ...cleaningConfig,
                    rowFilter: {
                      ...cleaningConfig.rowFilter,
                      value: e.target.value,
                    },
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-label clean-inline-check">
            <input
              type="checkbox"
              checked={cleaningConfig.rowFilter.enabled}
              onChange={(e) =>
                updateConfig({
                  ...cleaningConfig,
                  rowFilter: {
                    ...cleaningConfig.rowFilter,
                    enabled: e.target.checked,
                  },
                })
              }
            />
            Apply row filter before duplicates and sampling
          </label>
        </fieldset>
      </div>
      {footer}
    </div>
  );
}

import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import type { CleaningConfig, Dataset } from "@/types";
import "@/components/CleaningPanel/CleaningPanel.css";

export type SortStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function SortStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: SortStepProps) {
  return (
    <div className="clean-step-panel">
      <h3>Sort rows</h3>
      <p className="clean-hint-line">
        Sort the dataset by one or more columns before export. Applied after all
        other processing steps.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.sort} />}
      {cleaningConfig.sortRules.map((rule, i) => (
        <div
          key={i}
          className="clean-inline-grid clean-inline-grid--compact"
          style={{ marginBottom: 8 }}
        >
          <label>
            Column
            <select
              className="clean-select"
              value={rule.column}
              onChange={(e) => {
                const next = [...cleaningConfig.sortRules];
                next[i] = { ...next[i], column: e.target.value };
                updateConfig({ ...cleaningConfig, sortRules: next });
              }}
            >
              {raw.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              className="clean-select"
              value={rule.direction}
              onChange={(e) => {
                const next = [...cleaningConfig.sortRules];
                next[i] = {
                  ...next[i],
                  direction: e.target.value as "asc" | "desc",
                };
                updateConfig({ ...cleaningConfig, sortRules: next });
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                sortRules: cleaningConfig.sortRules.filter((_, j) => j !== i),
              })
            }
          ></button>
        </div>
      ))}
      <button
        className="btn-ghost btn-sm"
        onClick={() =>
          updateConfig({
            ...cleaningConfig,
            sortRules: [
              ...cleaningConfig.sortRules,
              {
                column: raw.columns[0]?.name ?? "",
                direction: "asc",
              },
            ],
          })
        }
      >
        + Add sort rule
      </button>
      {footer}
    </div>
  );
}

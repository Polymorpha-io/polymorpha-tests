import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type DerivedStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function DerivedStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: DerivedStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["derivedColumns"][number]>,
  ) => {
    const next = [...cleaningConfig.derivedColumns];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, derivedColumns: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Derived columns</h3>
      <p className="clean-hint-line">
        Create new columns from simple expressions. Use column names as
        variables (e.g. "age / 10" or "col_a - col_b").
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.derived.headers}
          before={EXAMPLES.derived.before}
          after={EXAMPLES.derived.after}
          afterHeaders={EXAMPLES.derived.afterHeaders}
          captionBefore={EXAMPLES.derived.captionBefore}
          captionAfter={EXAMPLES.derived.captionAfter}
        />
      )}
      {cleaningConfig.derivedColumns.map((rule, i) => (
        <div
          key={i}
          className="clean-inline-grid clean-inline-grid--compact"
          style={{ marginBottom: 8 }}
        >
          <label>
            New column name
            <input
              className="clean-input"
              value={rule.name}
              onChange={(e) => updateRule(i, { name: e.target.value })}
            />
          </label>
          <label>
            Expression
            <input
              className="clean-input"
              placeholder="e.g. col_a / col_b"
              value={rule.expression}
              onChange={(e) => updateRule(i, { expression: e.target.value })}
            />
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                derivedColumns: cleaningConfig.derivedColumns.filter(
                  (_, j) => j !== i,
                ),
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
            derivedColumns: [
              ...cleaningConfig.derivedColumns,
              { name: "", expression: "" },
            ],
          })
        }
      >
        + Add derived column
      </button>
      {footer}
    </div>
  );
}

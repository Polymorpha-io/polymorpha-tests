import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Column, Dataset, MathTransform } from "@/types";

export type MathTransformStepProps = {
  raw: Dataset;
  numericColumns: Column[];
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function MathTransformStep({
  raw,
  numericColumns,
  cleaningConfig,
  updateConfig,
  footer,
}: MathTransformStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["mathTransforms"][number]>,
  ) => {
    const next = [...cleaningConfig.mathTransforms];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, mathTransforms: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Log / power transform</h3>
      <p className="clean-hint-line">
        Apply mathematical transformations to skewed numeric columns. Creates a
        new column with the suffix.
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.mathTransform.headers}
          before={EXAMPLES.mathTransform.before}
          after={EXAMPLES.mathTransform.after}
          afterHeaders={EXAMPLES.mathTransform.afterHeaders}
          captionBefore={EXAMPLES.mathTransform.captionBefore}
          captionAfter={EXAMPLES.mathTransform.captionAfter}
        />
      )}
      {cleaningConfig.mathTransforms.map((rule, i) => (
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
              onChange={(e) => updateRule(i, { column: e.target.value })}
            >
              {numericColumns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Transform
            <select
              className="clean-select"
              value={rule.transform}
              onChange={(e) =>
                updateRule(i, { transform: e.target.value as MathTransform })
              }
            >
              <option value="log">ln (natural log)</option>
              <option value="log2">log₂</option>
              <option value="log10">log₁₀</option>
              <option value="sqrt">√ (square root)</option>
              <option value="square">x² (square)</option>
              <option value="reciprocal">1/x (reciprocal)</option>
            </select>
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                mathTransforms: cleaningConfig.mathTransforms.filter(
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
            mathTransforms: [
              ...cleaningConfig.mathTransforms,
              {
                column: numericColumns[0]?.name ?? "",
                transform: "log",
              },
            ],
          })
        }
      >
        + Add transform
      </button>
      {footer}
    </div>
  );
}

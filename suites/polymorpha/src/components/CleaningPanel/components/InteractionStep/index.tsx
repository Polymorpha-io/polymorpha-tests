import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Column, Dataset, InteractionRule } from "@/types";

export type InteractionStepProps = {
  raw: Dataset;
  numericColumns: Column[];
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function InteractionStep({
  raw,
  numericColumns,
  cleaningConfig,
  updateConfig,
  footer,
}: InteractionStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["interactionTerms"][number]>,
  ) => {
    const next = [...cleaningConfig.interactionTerms];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, interactionTerms: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Interaction terms</h3>
      <p className="clean-hint-line">
        Combine two numeric columns with an operation to create interaction
        features for regression.
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.interaction.headers}
          before={EXAMPLES.interaction.before}
          after={EXAMPLES.interaction.after}
          afterHeaders={EXAMPLES.interaction.afterHeaders}
          captionBefore={EXAMPLES.interaction.captionBefore}
          captionAfter={EXAMPLES.interaction.captionAfter}
        />
      )}
      {cleaningConfig.interactionTerms.map((rule, i) => (
        <div
          key={i}
          className="clean-inline-grid"
          style={{
            gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto",
            marginBottom: 8,
          }}
        >
          <label>
            Column A
            <select
              className="clean-select"
              value={rule.columnA}
              onChange={(e) => updateRule(i, { columnA: e.target.value })}
            >
              {numericColumns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operation
            <select
              className="clean-select"
              value={rule.operation}
              onChange={(e) =>
                updateRule(i, {
                  operation: e.target.value as InteractionRule["operation"],
                })
              }
            >
              <option value="multiply">× Multiply</option>
              <option value="add">+ Add</option>
              <option value="subtract">− Subtract</option>
              <option value="divide">÷ Divide</option>
            </select>
          </label>
          <label>
            Column B
            <select
              className="clean-select"
              value={rule.columnB}
              onChange={(e) => updateRule(i, { columnB: e.target.value })}
            >
              {numericColumns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                interactionTerms: cleaningConfig.interactionTerms.filter(
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
            interactionTerms: [
              ...cleaningConfig.interactionTerms,
              {
                columnA: numericColumns[0]?.name ?? "",
                columnB:
                  numericColumns[1]?.name ?? numericColumns[0]?.name ?? "",
                operation: "multiply",
              },
            ],
          })
        }
      >
        + Add interaction
      </button>
      {footer}
    </div>
  );
}

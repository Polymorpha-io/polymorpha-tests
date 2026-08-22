import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type LagLeadStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function LagLeadStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: LagLeadStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["lagLeadRules"][number]>,
  ) => {
    const next = [...cleaningConfig.lagLeadRules];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, lagLeadRules: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Lag / lead columns</h3>
      <p className="clean-hint-line">
        For time-series data, create shifted versions of a column. Positive
        offset = lag (past), negative = lead (future).
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.lagLead.headers}
          before={EXAMPLES.lagLead.before}
          after={EXAMPLES.lagLead.after}
          afterHeaders={EXAMPLES.lagLead.afterHeaders}
          captionBefore={EXAMPLES.lagLead.captionBefore}
          captionAfter={EXAMPLES.lagLead.captionAfter}
        />
      )}
      {cleaningConfig.lagLeadRules.map((rule, i) => (
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
              {raw.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Offset (positive = lag)
            <input
              className="clean-input"
              type="number"
              value={rule.offset}
              onChange={(e) =>
                updateRule(i, { offset: Number(e.target.value) || 1 })
              }
            />
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                lagLeadRules: cleaningConfig.lagLeadRules.filter(
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
            lagLeadRules: [
              ...cleaningConfig.lagLeadRules,
              { column: raw.columns[0]?.name ?? "", offset: 1 },
            ],
          })
        }
      >
        + Add lag/lead
      </button>
      {footer}
    </div>
  );
}

import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Column, Dataset } from "@/types";

export type BinStepProps = {
  raw: Dataset;
  numericColumns: Column[];
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function BinStep({
  raw,
  numericColumns,
  cleaningConfig,
  updateConfig,
  footer,
}: BinStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["binRules"][number]>,
  ) => {
    const next = [...cleaningConfig.binRules];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, binRules: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Bin / discretize</h3>
      <p className="clean-hint-line">
        Convert numeric columns into categorical bins by creating a new{" "}
        <code>_bin</code> column (e.g. age → age_bin).
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.bin.headers}
          before={EXAMPLES.bin.before}
          after={EXAMPLES.bin.after}
          afterHeaders={EXAMPLES.bin.afterHeaders}
          captionBefore={EXAMPLES.bin.captionBefore}
          captionAfter={EXAMPLES.bin.captionAfter}
        />
      )}
      {cleaningConfig.binRules.map((rule, i) => (
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
            Number of bins
            <input
              className="clean-input"
              type="number"
              min={2}
              max={20}
              value={rule.bins}
              onChange={(e) =>
                updateRule(i, { bins: Number(e.target.value) || 2 })
              }
            />
          </label>
          <label className="clean-inline-full">
            Bin labels (optional)
            <input
              className="clean-input"
              type="text"
              placeholder="Low, Medium, High"
              value={rule.labels?.join(", ") ?? ""}
              onChange={(e) => {
                const labels = e.target.value
                  .split(",")
                  .map((label) => label.trim())
                  .filter(Boolean);
                updateRule(i, {
                  labels: labels.length > 0 ? labels : undefined,
                });
              }}
            />
          </label>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                binRules: cleaningConfig.binRules.filter((_, j) => j !== i),
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
            binRules: [
              ...cleaningConfig.binRules,
              { column: numericColumns[0]?.name ?? "", bins: 5 },
            ],
          })
        }
      >
        + Add bin rule
      </button>
      {footer}
    </div>
  );
}

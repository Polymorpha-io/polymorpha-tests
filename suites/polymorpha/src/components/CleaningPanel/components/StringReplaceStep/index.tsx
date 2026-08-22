import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset, StringMatchMode } from "@/types";

export type StringReplaceStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function StringReplaceStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: StringReplaceStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["stringReplace"][number]>,
  ) => {
    const next = [...cleaningConfig.stringReplace];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, stringReplace: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>String replace</h3>
      <p className="clean-hint-line">
        Find and replace specific text values across columns.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.stringReplace} />}
      {cleaningConfig.stringReplace.map((rule, i) => (
        <div
          key={i}
          className="clean-option-card"
          style={{ marginBottom: 8, position: "relative" }}
        >
          <button
            className="btn-ghost btn-sm clean-remove-btn clean-remove-btn--abs"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                stringReplace: cleaningConfig.stringReplace.filter(
                  (_, j) => j !== i,
                ),
              })
            }
          ></button>
          <div
            className="clean-inline-grid"
            style={{
              gridTemplateColumns: "1fr 1fr",
              gap: "8px 12px",
            }}
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
              Match mode
              <select
                className="clean-select"
                value={rule.matchMode || "contains"}
                onChange={(e) =>
                  updateRule(i, {
                    matchMode: e.target.value as StringMatchMode,
                  })
                }
              >
                <option value="contains">Contains (partial)</option>
                <option value="exact">Exact match</option>
                <option value="startsWith">Starts with</option>
                <option value="endsWith">Ends with</option>
                <option value="wholeWord">Whole word</option>
                <option value="regex">Regex</option>
              </select>
            </label>
            <label>
              Find
              <input
                className="clean-input"
                value={rule.find}
                placeholder="Text to find..."
                onChange={(e) => updateRule(i, { find: e.target.value })}
              />
            </label>
            <label>
              Replace with
              <input
                className="clean-input"
                value={rule.replace}
                placeholder="Replacement text..."
                onChange={(e) => updateRule(i, { replace: e.target.value })}
              />
            </label>
          </div>
          <label
            className="checkbox-label clean-inline-check"
            style={{ marginTop: 8 }}
          >
            <input
              type="checkbox"
              checked={rule.caseSensitive}
              onChange={(e) =>
                updateRule(i, { caseSensitive: e.target.checked })
              }
            />
            Case sensitive
          </label>
        </div>
      ))}
      <button
        className="btn-ghost btn-sm"
        onClick={() =>
          updateConfig({
            ...cleaningConfig,
            stringReplace: [
              ...cleaningConfig.stringReplace,
              {
                column: raw.columns[0]?.name ?? "",
                find: "",
                replace: "",
                caseSensitive: false,
                matchMode: "contains",
              },
            ],
          })
        }
      >
        + Add replace rule
      </button>
      {footer}
    </div>
  );
}

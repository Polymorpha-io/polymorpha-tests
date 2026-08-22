import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type StandardizeStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function StandardizeStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: StandardizeStepProps) {
  const updateMapping = (
    index: number,
    partial: Partial<CleaningConfig["categoryMappings"][number]>,
  ) => {
    const next = [...cleaningConfig.categoryMappings];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, categoryMappings: next });
  };

  const updateSubMapping = (
    index: number,
    subIndex: number,
    partial: Partial<
      CleaningConfig["categoryMappings"][number]["mappings"][number]
    >,
  ) => {
    const next = [...cleaningConfig.categoryMappings];
    const mappings = [...next[index].mappings];
    mappings[subIndex] = { ...mappings[subIndex], ...partial };
    next[index] = { ...next[index], mappings };
    updateConfig({ ...cleaningConfig, categoryMappings: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Standardize categories</h3>
      <p className="clean-hint-line">
        Merge misspelled or inconsistent category labels into one canonical
        value. E.g. "Male", "male", "M" → "Male".
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.standardize} />}
      {cleaningConfig.categoryMappings.map((mapping, i) => (
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
                categoryMappings: cleaningConfig.categoryMappings.filter(
                  (_, j) => j !== i,
                ),
              })
            }
          ></button>
          <div className="clean-inline-grid clean-inline-grid--compact">
            <label>
              Column
              <select
                className="clean-select"
                value={mapping.column}
                onChange={(e) => updateMapping(i, { column: e.target.value })}
              >
                {raw.columns
                  .filter((c) => c.type === "categorical")
                  .map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {mapping.mappings.map((m, mi) => (
            <div
              key={mi}
              className="clean-inline-grid clean-inline-grid--compact"
              style={{ marginTop: 6 }}
            >
              <label>
                From (comma-separated)
                <input
                  className="clean-input"
                  value={m.from.join(", ")}
                  onChange={(e) =>
                    updateSubMapping(i, mi, {
                      from: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                />
              </label>
              <label>
                To
                <input
                  className="clean-input"
                  value={m.to}
                  onChange={(e) =>
                    updateSubMapping(i, mi, { to: e.target.value })
                  }
                />
              </label>
              <button
                className="btn-ghost btn-sm"
                onClick={() =>
                  updateMapping(i, {
                    mappings: cleaningConfig.categoryMappings[
                      i
                    ].mappings.filter((_, j) => j !== mi),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn-ghost btn-sm"
            style={{ marginTop: 6 }}
            onClick={() =>
              updateMapping(i, {
                mappings: [
                  ...cleaningConfig.categoryMappings[i].mappings,
                  { from: [], to: "" },
                ],
              })
            }
          >
            + Add mapping
          </button>
        </div>
      ))}
      <button
        className="btn-ghost btn-sm"
        onClick={() =>
          updateConfig({
            ...cleaningConfig,
            categoryMappings: [
              ...cleaningConfig.categoryMappings,
              {
                column:
                  raw.columns.find((c) => c.type === "categorical")?.name ?? "",
                mappings: [{ from: [], to: "" }],
              },
            ],
          })
        }
      >
        + Add category mapping
      </button>
      {footer}
    </div>
  );
}

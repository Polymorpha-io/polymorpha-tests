import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, DatePart, Dataset } from "@/types";

export type DateExtractStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

const DATE_PARTS: DatePart[] = [
  "year",
  "month",
  "dayOfWeek",
  "hour",
  "quarter",
];

export function DateExtractStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: DateExtractStepProps) {
  const updateRule = (
    index: number,
    partial: Partial<CleaningConfig["dateExtraction"][number]>,
  ) => {
    const next = [...cleaningConfig.dateExtraction];
    next[index] = { ...next[index], ...partial };
    updateConfig({ ...cleaningConfig, dateExtraction: next });
  };

  return (
    <div className="clean-step-panel">
      <h3>Date extraction</h3>
      <p className="clean-hint-line">
        Pull year, month, day-of-week, hour, or quarter from date columns into
        new columns.
      </p>
      {raw.rows.length === 0 && (
        <BeforeAfter
          headers={EXAMPLES.dateExtract.headers}
          before={EXAMPLES.dateExtract.before}
          after={EXAMPLES.dateExtract.after}
          afterHeaders={EXAMPLES.dateExtract.afterHeaders}
          captionBefore={EXAMPLES.dateExtract.captionBefore}
          captionAfter={EXAMPLES.dateExtract.captionAfter}
        />
      )}
      {cleaningConfig.dateExtraction.map((rule, i) => (
        <div key={i} className="clean-option-card" style={{ marginBottom: 8 }}>
          <label>
            Date column
            <select
              className="clean-select"
              value={rule.column}
              onChange={(e) => updateRule(i, { column: e.target.value })}
            >
              {raw.columns
                .filter((c) => c.type === "date")
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              {raw.columns
                .filter((c) => c.type !== "date")
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="col-checkboxes" style={{ marginTop: 8 }}>
            {DATE_PARTS.map((part) => (
              <label key={part} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rule.parts.includes(part)}
                  onChange={(e) =>
                    updateRule(i, {
                      parts: e.target.checked
                        ? [...rule.parts, part]
                        : rule.parts.filter((p) => p !== part),
                    })
                  }
                />
                {part}
              </label>
            ))}
          </div>
          <button
            className="btn-ghost btn-sm clean-remove-btn"
            onClick={() =>
              updateConfig({
                ...cleaningConfig,
                dateExtraction: cleaningConfig.dateExtraction.filter(
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
            dateExtraction: [
              ...cleaningConfig.dateExtraction,
              {
                column:
                  raw.columns.find((c) => c.type === "date")?.name ??
                  raw.columns[0]?.name ??
                  "",
                parts: ["year", "month"],
              },
            ],
          })
        }
      >
        + Add extraction
      </button>
      {footer}
    </div>
  );
}

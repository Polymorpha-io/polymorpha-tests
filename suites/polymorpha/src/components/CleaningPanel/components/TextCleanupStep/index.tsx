import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset, StringCaseMode } from "@/types";

export type TextCleanupStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function TextCleanupStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: TextCleanupStepProps) {
  const updateStringCleaning = (
    partial: Partial<CleaningConfig["stringCleaning"]>,
  ) => {
    updateConfig({
      ...cleaningConfig,
      stringCleaning: {
        ...cleaningConfig.stringCleaning,
        ...partial,
      },
    });
  };

  return (
    <div className="clean-step-panel">
      <h3>Text cleanup</h3>
      <p className="clean-hint-line">
        Trim whitespace, change case, apply regex replacements.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.textCleanup} />}
      <label className="checkbox-label clean-inline-check">
        <input
          type="checkbox"
          checked={cleaningConfig.stringCleaning.enabled}
          onChange={(e) => updateStringCleaning({ enabled: e.target.checked })}
        />
        Enable text cleanup
      </label>
      <div className="clean-option-card">
        <div
          className="clean-inline-grid"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <label>
            Case mode
            <select
              className="clean-select"
              value={cleaningConfig.stringCleaning.caseMode}
              onChange={(e) =>
                updateStringCleaning({
                  caseMode: e.target.value as StringCaseMode,
                })
              }
            >
              <option value="none">Keep case</option>
              <option value="lower">Lowercase</option>
              <option value="upper">Uppercase</option>
              <option value="title">Title case</option>
            </select>
          </label>
          <label>
            Regex pattern
            <input
              className="clean-input"
              placeholder="e.g. [^a-zA-Z0-9]"
              value={cleaningConfig.stringCleaning.regexPattern}
              onChange={(e) =>
                updateStringCleaning({ regexPattern: e.target.value })
              }
            />
          </label>
          <label>
            Regex replacement
            <input
              className="clean-input"
              placeholder="e.g. _"
              value={cleaningConfig.stringCleaning.regexReplacement}
              onChange={(e) =>
                updateStringCleaning({ regexReplacement: e.target.value })
              }
            />
          </label>
        </div>
        <label className="checkbox-label clean-inline-check">
          <input
            type="checkbox"
            checked={cleaningConfig.stringCleaning.trim}
            onChange={(e) => updateStringCleaning({ trim: e.target.checked })}
          />
          Trim leading and trailing whitespace
        </label>
      </div>
      {footer}
    </div>
  );
}

import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { CleaningConfig, Dataset } from "@/types";

export type TypeConversionStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function TypeConversionStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: TypeConversionStepProps) {
  const updateTypeConversion = (
    partial: Partial<CleaningConfig["typeConversion"]>,
  ) => {
    updateConfig({
      ...cleaningConfig,
      typeConversion: {
        ...cleaningConfig.typeConversion,
        ...partial,
      },
    });
  };

  return (
    <div className="clean-step-panel">
      <h3>Type conversion</h3>
      <p className="clean-hint-line">
        Coerce strings to numbers, dates, and booleans.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.typeConversion} />}
      <label className="checkbox-label clean-inline-check">
        <input
          type="checkbox"
          checked={cleaningConfig.typeConversion.enabled}
          onChange={(e) => updateTypeConversion({ enabled: e.target.checked })}
        />
        Enable type conversion
      </label>
      <div className="clean-option-card clean-option-card--prominent">
        <div className="clean-inline-grid clean-inline-grid--compact">
          <label>
            Numeric parsing
            <select
              className="clean-select"
              value={cleaningConfig.typeConversion.numericParseMode}
              onChange={(e) =>
                updateTypeConversion({
                  numericParseMode: e.target
                    .value as CleaningConfig["typeConversion"]["numericParseMode"],
                })
              }
            >
              <option value="strict">Strict</option>
              <option value="lenient">Lenient</option>
            </select>
          </label>
          <label>
            Date parsing
            <select
              className="clean-select"
              value={cleaningConfig.typeConversion.dateParseMode}
              onChange={(e) =>
                updateTypeConversion({
                  dateParseMode: e.target
                    .value as CleaningConfig["typeConversion"]["dateParseMode"],
                })
              }
            >
              <option value="none">Leave as text</option>
              <option value="iso">ISO only</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
        </div>
        <label className="checkbox-label clean-inline-check">
          <input
            type="checkbox"
            checked={cleaningConfig.typeConversion.booleanConversion}
            onChange={(e) =>
              updateTypeConversion({ booleanConversion: e.target.checked })
            }
          />
          Convert yes/no, true/false, and 1/0 to booleans
        </label>
      </div>
      {footer}
    </div>
  );
}

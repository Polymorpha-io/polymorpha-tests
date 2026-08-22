import type { ReactNode } from "react";
import { BeforeAfter, EXAMPLES } from "@/components/CleaningPanel/BeforeAfter";
import type { CleaningConfig, Dataset, SampleMethod } from "@/types";
import "@/components/CleaningPanel/CleaningPanel.css";

export type SamplingStepProps = {
  raw: Dataset;
  cleaningConfig: CleaningConfig;
  updateConfig: (next: CleaningConfig) => void;
  footer: ReactNode;
};

export function SamplingStep({
  raw,
  cleaningConfig,
  updateConfig,
  footer,
}: SamplingStepProps) {
  return (
    <div className="clean-step-panel">
      <h3>Row sampling</h3>
      <p className="clean-hint-line">
        Limit the output to a subset of rows. Applied at the end of the
        processing pipeline.
      </p>
      {raw.rows.length === 0 && <BeforeAfter {...EXAMPLES.sampling} />}
      <div className="clean-inline-grid clean-inline-grid--compact">
        <label>
          Method
          <select
            className="clean-select"
            value={cleaningConfig.sampling.method}
            onChange={(e) =>
              updateConfig({
                ...cleaningConfig,
                sampling: {
                  ...cleaningConfig.sampling,
                  method: e.target.value as SampleMethod,
                },
              })
            }
          >
            <option value="none">Keep all rows</option>
            <option value="head">Head (first N)</option>
            <option value="tail">Tail (last N)</option>
            <option value="random">Random sample</option>
          </select>
        </label>
        <label>
          Count
          <input
            className="clean-input"
            type="number"
            min={1}
            max={Math.max(1, raw.rows.length)}
            value={cleaningConfig.sampling.count}
            onChange={(e) =>
              updateConfig({
                ...cleaningConfig,
                sampling: {
                  ...cleaningConfig.sampling,
                  count: Number(e.target.value) || 1,
                },
              })
            }
          />
        </label>
      </div>
      {footer}
    </div>
  );
}

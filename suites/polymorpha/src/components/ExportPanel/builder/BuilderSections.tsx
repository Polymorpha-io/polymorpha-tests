import { CheckItem } from "@/components/ExportPanel/HtmlPreview";
import type { ReportBuilderProps } from "./builderShared";

export function BuilderSections({
  exportPreferences,
  setExportPreferences,
  numericCols,
  categoricalCols,
  descriptiveSelection,
  frequencySelection,
}: ReportBuilderProps) {
  return (
    <div className="ep-card">
      <div className="ep-card-head">
        <span className="ep-card-icon">{"\uD83D\uDCD1"}</span>
        <h4>Sections</h4>
      </div>
      <div className="ep-card-body ep-checklist">
        <CheckItem
          label="Executive Summary"
          desc="Overview of key findings"
          checked={exportPreferences.includeExecutiveSummary}
          onChange={(v) => setExportPreferences({ includeExecutiveSummary: v })}
        />
        <CheckItem
          label="Data Preparation"
          desc="Cleaning steps applied"
          checked={exportPreferences.includeDataPreparation}
          onChange={(v) => setExportPreferences({ includeDataPreparation: v })}
        />
        <CheckItem
          label="Descriptive Statistics"
          desc={`${descriptiveSelection === null ? numericCols.length : descriptiveSelection.length} selected`}
          checked={exportPreferences.includeDescriptive}
          onChange={(v) => setExportPreferences({ includeDescriptive: v })}
        />
        <p className="ep-vis-hint">
          Choose numeric columns included in descriptive statistics.
        </p>
        <div className="ep-col-picker">
          {numericCols.map((col) => {
            const selected =
              descriptiveSelection === null ||
              descriptiveSelection.includes(col.name);
            return (
              <label
                key={col.name}
                className={`ep-col-chip ${selected ? "ep-col-chip--on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current =
                      descriptiveSelection ?? numericCols.map((c) => c.name);
                    const next = e.target.checked
                      ? Array.from(new Set([...current, col.name]))
                      : current.filter((name) => name !== col.name);
                    setExportPreferences({
                      descriptiveColumns:
                        next.length === numericCols.length ? null : next,
                    });
                  }}
                />
                <span>{col.name}</span>
                <span className="ep-col-chip-type">N</span>
              </label>
            );
          })}
        </div>
        <div className="ep-vis-actions ep-vis-actions--compact">
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ descriptiveColumns: null })}
          >
            All numeric
          </button>
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ descriptiveColumns: [] })}
          >
            None
          </button>
        </div>
        <CheckItem
          label="Frequency Tables"
          desc={`${frequencySelection === null ? categoricalCols.length : frequencySelection.length} categorical columns`}
          checked={exportPreferences.includeFrequencies}
          onChange={(v) => setExportPreferences({ includeFrequencies: v })}
        />
        <p className="ep-vis-hint">
          Choose categorical columns included in frequency analysis.
        </p>
        <div className="ep-col-picker">
          {categoricalCols.map((col) => {
            const selected =
              frequencySelection === null ||
              frequencySelection.includes(col.name);
            return (
              <label
                key={col.name}
                className={`ep-col-chip ${selected ? "ep-col-chip--on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current =
                      frequencySelection ?? categoricalCols.map((c) => c.name);
                    const next = e.target.checked
                      ? Array.from(new Set([...current, col.name]))
                      : current.filter((name) => name !== col.name);
                    setExportPreferences({
                      frequencyColumns:
                        next.length === categoricalCols.length ? null : next,
                    });
                  }}
                />
                <span>{col.name}</span>
                <span className="ep-col-chip-type">A</span>
              </label>
            );
          })}
        </div>
        <div className="ep-vis-actions ep-vis-actions--compact">
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ frequencyColumns: null })}
          >
            All categorical
          </button>
          <button
            className="ep-link-btn"
            onClick={() => setExportPreferences({ frequencyColumns: [] })}
          >
            None
          </button>
        </div>
        <CheckItem
          label="Normality Assessment"
          desc="Distribution tests per column"
          checked={exportPreferences.includeNormality}
          onChange={(v) => setExportPreferences({ includeNormality: v })}
        />
        <CheckItem
          label="Correlation Matrix"
          desc="Numeric variable relationships"
          checked={exportPreferences.includeCorrelation}
          onChange={(v) => setExportPreferences({ includeCorrelation: v })}
        />
        <CheckItem
          label="Statistical Tests"
          desc="Hypothesis test results"
          checked={exportPreferences.includeTests}
          onChange={(v) => setExportPreferences({ includeTests: v })}
        />
        <CheckItem
          label="Methodology Notes"
          desc="Assumptions and procedures"
          checked={exportPreferences.includeMethodology}
          onChange={(v) => setExportPreferences({ includeMethodology: v })}
        />
        <CheckItem
          label="Inline Column Stats"
          desc="Mini-tables per column"
          checked={exportPreferences.includeInlineColumnStats}
          onChange={(v) =>
            setExportPreferences({ includeInlineColumnStats: v })
          }
        />
      </div>
    </div>
  );
}

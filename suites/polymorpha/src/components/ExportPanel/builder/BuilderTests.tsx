import { CheckItem } from "@/components/ExportPanel/HtmlPreview";
import type { ReportBuilderProps } from "./builderShared";

export function BuilderTests({
  exportPreferences,
  setExportPreferences,
  results,
  totalTests,
}: ReportBuilderProps) {
  return (
    <div className="ep-card">
      <div className="ep-card-head">
        <span className="ep-card-icon">{"\uD83E\uDDEA"}</span>
        <h4>Statistical Tests</h4>
        {totalTests > 0 && <span className="ep-badge">{totalTests} run</span>}
      </div>
      {totalTests === 0 && (
        <div className="ep-test-warning">
          <p>
            No tests have been run yet. Go to the Analyse tab and run
            statistical tests before exporting to include them in your report.
          </p>
        </div>
      )}
      <div className="ep-card-body ep-checklist">
        <CheckItem
          label="T-Tests"
          desc={
            results.tTests.length > 0
              ? `${results.tTests.length} result${results.tTests.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportTTests}
          onChange={(v) => setExportPreferences({ exportTTests: v })}
        />
        <CheckItem
          label="ANOVA"
          desc={
            results.anova.length > 0
              ? `${results.anova.length} result${results.anova.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportAnova}
          onChange={(v) => setExportPreferences({ exportAnova: v })}
        />
        <CheckItem
          label="Mann-Whitney U"
          desc={
            results.mannWhitney.length > 0
              ? `${results.mannWhitney.length} result${results.mannWhitney.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportMannWhitney}
          onChange={(v) => setExportPreferences({ exportMannWhitney: v })}
        />
        <CheckItem
          label="Kruskal-Wallis"
          desc={
            results.kruskalWallis.length > 0
              ? `${results.kruskalWallis.length} result${results.kruskalWallis.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportKruskalWallis}
          onChange={(v) => setExportPreferences({ exportKruskalWallis: v })}
        />
        <CheckItem
          label="Chi-Square"
          desc={
            results.chiSquare.length > 0
              ? `${results.chiSquare.length} result${results.chiSquare.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportChiSquare}
          onChange={(v) => setExportPreferences({ exportChiSquare: v })}
        />
        <CheckItem
          label="Regression"
          desc={
            results.regression.length > 0
              ? `${results.regression.length} result${results.regression.length > 1 ? "s" : ""}`
              : "Not run"
          }
          checked={exportPreferences.exportRegression}
          onChange={(v) => setExportPreferences({ exportRegression: v })}
        />
        <CheckItem
          label="Pairwise Narratives"
          desc="APA write-ups per pair"
          checked={exportPreferences.includePairwiseTests}
          onChange={(v) => setExportPreferences({ includePairwiseTests: v })}
        />
      </div>
    </div>
  );
}

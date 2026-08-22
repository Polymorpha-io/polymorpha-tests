import { VisualiseTab } from "@/components/AnalysePanel/tabs/VisualiseTab";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { Dataset } from "@/types";

export type ExploreVisualiseStepProps = {
  exploreData: Dataset | null;
  exploreComputed: ComputedStats | null;
};

export function ExploreVisualiseStep({
  exploreData,
  exploreComputed,
}: ExploreVisualiseStepProps) {
  const canAdvancedCharts = true;
  const canChartCustomization = true;

  return (
    <div className="clean-step-panel">
      {exploreData && exploreComputed ? (
        <VisualiseTab
          cleaned={exploreData}
          computed={exploreComputed}
          canAdvancedCharts={canAdvancedCharts}
          canChartCustomization={canChartCustomization}
          allCorrPairs={[]}
          onError={() => {}}
        />
      ) : (
        <div className="explore-empty">
          <h3>Visualise</h3>
          <p className="clean-hint-line">
            Upload a dataset to explore it visually.
          </p>
        </div>
      )}
    </div>
  );
}

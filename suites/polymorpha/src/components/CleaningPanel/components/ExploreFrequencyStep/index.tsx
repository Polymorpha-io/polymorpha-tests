import { FrequenciesTab } from "@/components/AnalysePanel/tabs/FrequenciesTab";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { Dataset } from "@/types";

export type ExploreFrequencyStepProps = {
  exploreData: Dataset | null;
  exploreComputed: ComputedStats | null;
};

export function ExploreFrequencyStep({
  exploreData,
  exploreComputed,
}: ExploreFrequencyStepProps) {
  return (
    <div className="clean-step-panel">
      {exploreData && exploreComputed ? (
        <FrequenciesTab computed={exploreComputed} />
      ) : (
        <div className="explore-empty">
          <h3>Frequencies</h3>
          <p className="clean-hint-line">
            Upload a dataset to see frequency tables.
          </p>
        </div>
      )}
    </div>
  );
}

import { DescriptiveTab } from "@/components/AnalysePanel/tabs/DescriptiveTab";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import "@/components/CleaningPanel/CleaningPanel.css";
import type { Dataset } from "@/types";

export type ExploreDescriptiveStepProps = {
  exploreData: Dataset | null;
  exploreComputed: ComputedStats | null;
};

export function ExploreDescriptiveStep({
  exploreData,
  exploreComputed,
}: ExploreDescriptiveStepProps) {
  return (
    <div className="clean-step-panel">
      {exploreData && exploreComputed ? (
        <DescriptiveTab computed={exploreComputed} />
      ) : (
        <div className="explore-empty">
          <h3>Descriptive statistics</h3>
          <p className="clean-hint-line">
            Upload a dataset to see descriptive statistics.
          </p>
        </div>
      )}
    </div>
  );
}

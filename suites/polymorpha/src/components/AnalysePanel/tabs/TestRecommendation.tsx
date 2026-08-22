import type { Dispatch, SetStateAction } from "react";
import type { Dataset } from "@/types";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";

interface RecommendationView {
  label: string;
  reason: string;
}

interface TestRecommendationProps {
  cleaned: Dataset;
  probeColA: string;
  setProbeColA: Dispatch<SetStateAction<string>>;
  probeColB: string;
  setProbeColB: Dispatch<SetStateAction<string>>;
  recommendation: RecommendationView;
  selectedPairSummary: string;
  applyRecommendation: () => void;
}

export function TestRecommendation({
  cleaned,
  probeColA,
  setProbeColA,
  probeColB,
  setProbeColB,
  recommendation,
  selectedPairSummary,
  applyRecommendation,
}: TestRecommendationProps) {
  return (
    <section className="stat-test-card tests-selector">
      <div className="tests-prefill-head">
        <div>
          <p className="tests-banner-kicker">Test recommendation</p>
          <h3>Auto-detect</h3>
        </div>
        <p className="clean-hint-line">
          Select two variables to get the best test recommendation for your
          data.
        </p>
      </div>
      <div className="tests-selector-grid">
        <label className="test-field">
          <span className="test-field-label">Variable A</span>
          <select
            value={probeColA}
            onChange={(e) => setProbeColA(e.target.value)}
          >
            <option value="">Select variable</option>
            {cleaned.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {formatColumnLabel(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="test-field">
          <span className="test-field-label">Variable B</span>
          <select
            value={probeColB}
            onChange={(e) => setProbeColB(e.target.value)}
          >
            <option value="">Select variable</option>
            {cleaned.columns.map((c) => (
              <option key={c.name} value={c.name}>
                {formatColumnLabel(c.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tests-recommend-banner">
        <div className="tests-recommend-copy">
          <p className="tests-banner-kicker">Recommended test</p>
          <p className="tests-banner-title">{recommendation.label}</p>
          <p className="clean-hint-line">{recommendation.reason}</p>
        </div>
        <div className="tests-banner-actions">
          <span className="recommend-pill">{selectedPairSummary}</span>
          <button className="btn-primary btn-sm" onClick={applyRecommendation}>
            Apply and configure
          </button>
        </div>
      </div>
    </section>
  );
}

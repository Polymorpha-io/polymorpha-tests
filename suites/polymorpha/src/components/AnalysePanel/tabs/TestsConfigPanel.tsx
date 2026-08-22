import React from "react";
import type { StatsLevel } from "@/store/usePrefsStore";
import type { Dataset } from "@/types";
import { TEST_GROUPS, TEST_META, formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";
import type { TestGroup, TestHighlight, TestKey } from "@/components/AnalysePanel/analyseHelpers";
import type { Recommendation as ResultRecommendation } from "@/lib/stats/tests";
import { InlineTestChart } from "./InlineTestChart";
import type { VizChartType } from "./InlineTestChart";
import {
  RecommendationsSection,
  ResultsSpotlight,
  FormulasSection,
} from "./TestsCart";
import type { FormulaCard } from "./testsRunner";

interface TestsConfigPanelProps {
  statsLevel: StatsLevel;
  activeTestKey: TestKey;
  setActiveTestKey: (k: TestKey) => void;
  setActiveTestGroup: (g: TestGroup) => void;
  setTestError: (e: string | null) => void;
  isTestLocked: (tk: TestKey) => boolean;
  selectedTests: Record<TestKey, boolean>;
  setSelectedTests: React.Dispatch<
    React.SetStateAction<Record<TestKey, boolean>>
  >;
  testHasResults: (tk: TestKey) => boolean;
  configCard: React.ReactNode;
  activeTestSummary: string | undefined;
  testWarnings: string[];
  testError: string | null;
  isRunning: boolean;
  currentTest: string;
  activeTestCanRun: boolean;
  runSingleTest: (tk: TestKey) => void;
  disabledReason: string | null;
  autoVizCols: { colA: string; colB?: string } | null;
  vizModalOpen: boolean;
  setVizModalOpen: (open: boolean) => void;
  vizChartType: VizChartType;
  setVizChartType: (t: VizChartType) => void;
  cleaned: Dataset;
  testHighlights: TestHighlight[];
  formulaCards: FormulaCard[];
  resultRecommendations: ResultRecommendation[];
}

export function TestsConfigPanel({
  statsLevel,
  activeTestKey,
  setActiveTestKey,
  setActiveTestGroup,
  setTestError,
  isTestLocked,
  selectedTests,
  setSelectedTests,
  testHasResults,
  configCard,
  activeTestSummary,
  testWarnings,
  testError,
  isRunning,
  currentTest,
  activeTestCanRun,
  runSingleTest,
  disabledReason,
  autoVizCols,
  vizModalOpen,
  setVizModalOpen,
  vizChartType,
  setVizChartType,
  cleaned,
  testHighlights,
  formulaCards,
  resultRecommendations,
}: TestsConfigPanelProps) {
  return (
    <>
      <aside className="tests-sidebar-nav">
        {TEST_GROUPS.filter((group) => {
          if (statsLevel === "basic")
            return group.id === "correlation" || group.id === "difference";
          if (statsLevel === "advanced") return group.id !== "regression";
          return true; // professional sees all
        }).map((group) => (
          <div key={group.id} className="tests-sidebar-group">
            <div className="tests-sidebar-group-title">{group.label}</div>
            {group.tests.map((tk) => {
              const locked = isTestLocked(tk);
              const active = activeTestKey === tk;
              return (
                <button
                  key={tk}
                  className={`tests-sidebar-item${active ? " tests-sidebar-item--active" : ""}${locked ? " tests-sidebar-item--locked" : ""}`}
                  onClick={() => {
                    if (locked) {
                      setTestError(
                        "This test is available on Member and Premium plans.",
                      );
                      return;
                    }
                    setTestError(null);
                    setActiveTestKey(tk);
                    setActiveTestGroup(TEST_META[tk].group);
                  }}
                >
                  <span className="tests-sidebar-item-name">
                    {TEST_META[tk].label}
                  </span>
                  {locked && <span className="tests-sidebar-lock">🔒</span>}
                  {!locked && selectedTests[tk] && (
                    <span
                      className="tests-sidebar-dot tests-sidebar-dot--queued"
                      title="In selection"
                    />
                  )}
                  {active && !locked && (
                    <span className="tests-sidebar-dot tests-sidebar-dot--active" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>
      <div className="tests-builder-main">
        <section className="stat-test-card tests-config tests-config--active">
          <div className="test-card-head tests-config-head">
            <div>
              <h3>{TEST_META[activeTestKey].label}</h3>
              <p className="clean-hint-line">
                {TEST_META[activeTestKey].summary}
              </p>
            </div>
          </div>
          {configCard}
          <div className="tests-config-footer">
            <div>
              <p className="tests-config-summary">{activeTestSummary}</p>
              <p className="clean-hint-line">
                This summary reflects the active method variables only. The
                shared pair above is just a prefill shortcut.
              </p>
            </div>
            {testWarnings.length > 0 && !testError && !isRunning && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <strong>Warnings:</strong>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {testWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="test-actions-row">
              <button
                className="btn-primary btn-sm"
                onClick={() => runSingleTest(activeTestKey)}
                disabled={
                  !activeTestCanRun || isTestLocked(activeTestKey) || isRunning
                }
                title={disabledReason ?? undefined}
              >
                Run
              </button>
              <button
                className="btn-ghost btn-sm"
                disabled={!autoVizCols}
                onClick={() => setVizModalOpen(true)}
              >
                Visualize
              </button>
              <button
                className={`btn-ghost btn-sm tests-cart-toggle${selectedTests[activeTestKey] ? " tests-cart-toggle--active" : ""}`}
                disabled={
                  isTestLocked(activeTestKey) || !testHasResults(activeTestKey)
                }
                onClick={() =>
                  setSelectedTests((prev) => ({
                    ...prev,
                    [activeTestKey]: !prev[activeTestKey],
                  }))
                }
              >
                {selectedTests[activeTestKey] ? "Remove" : "Extract"}
              </button>
            </div>
            {isRunning && currentTest && (
              <div
                className="tests-progress"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0",
                }}
              >
                <span
                  className="ml-spinner"
                  style={{ width: 16, height: 16, borderWidth: 2 }}
                />
                <span style={{ fontSize: "0.875rem" }}>
                  Running {currentTest}...
                </span>
              </div>
            )}
            {disabledReason && (
              <p className="tests-inline-hint">{disabledReason}</p>
            )}
            {testError && <p className="tests-inline-error">{testError}</p>}
            <p className="clean-hint-line tests-extract-hint">
              Visualization is included when you extract.
            </p>
          </div>
        </section>
        {vizModalOpen && autoVizCols && (
          <div
            className="tests-viz-modal-overlay"
            onClick={() => setVizModalOpen(false)}
          >
            <div
              className="tests-viz-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tests-viz-modal-head">
                <h4>
                  {formatColumnLabel(autoVizCols.colA)}
                  {autoVizCols.colB
                    ? ` vs ${formatColumnLabel(autoVizCols.colB)}`
                    : ""}
                </h4>
                <div className="tests-inline-viz-actions">
                  <select
                    className="tests-viz-chart-picker"
                    value={vizChartType}
                    onChange={(e) =>
                      setVizChartType(e.target.value as VizChartType)
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="scatter">Scatter</option>
                    <option value="box">Box Plot</option>
                    <option value="histogram">Histogram</option>
                  </select>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setVizModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="tests-viz-modal-chart">
                <InlineTestChart
                  cleaned={cleaned}
                  colA={autoVizCols.colA}
                  colB={autoVizCols.colB}
                  chartType={vizChartType}
                />
              </div>
            </div>
          </div>
        )}
        <section
          className="tests-mobile-results"
          aria-label="Mobile test results"
        >
          <ResultsSpotlight
            highlights={testHighlights}
            emptyText="Run this test to show result highlights here."
          />
          {formulaCards.length > 0 && (
            <FormulasSection formulaCards={formulaCards} />
          )}
          {resultRecommendations.length > 0 && (
            <RecommendationsSection recommendations={resultRecommendations} />
          )}
        </section>
      </div>
    </>
  );
}

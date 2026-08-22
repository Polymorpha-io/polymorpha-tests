import React from "react";
import type {
  BuilderContext,
  Recommendation,
} from "@polymorpha/business-logic";
import type { Recommendation as ResultRecommendation } from "@/lib/stats/tests";
import { usePrefsStore } from "@/store/usePrefsStore";
import { useDataStore } from "@/store/useDataStore";
import { useShallow } from "zustand/react/shallow";
import {
  getStorageBackedContext,
  resolveStorageBacked,
} from "@/lib/stats/storageBacked";
import type { Dataset, StatsResults, TTestType } from "@/types";
import {
  ADVANCED_TEST_KEYS,
  EMPTY_TEST_SELECTION,
  TEST_META,
  formatColumnLabel,
  humanizeColumnType,
} from "@/components/AnalysePanel/analyseHelpers";
import type {
  ComputedStats,
  TestGroup,
  TestHighlight,
  TestKey,
} from "@/components/AnalysePanel/analyseHelpers";
import { TestRecommendation } from "./TestRecommendation";
import type { VizChartType } from "./InlineTestChart";
import { useActiveTestCard } from "./useActiveTestCard";
import { computeActiveTestDerived } from "./testsTabDerived";
import { TestsCart, TestsCartMobile } from "./TestsCart";
import { TestsConfigPanel } from "./TestsConfigPanel";
import { runConfiguredTests as runConfiguredTestsCore } from "./testsRunner";
import type { FormulaCard } from "./testsRunner";

interface Props {
  cleaned: Dataset;
  computed: ComputedStats;
  results: StatsResults;
  canAdvancedTests: boolean;
  onSetResults: (r: StatsResults) => void;
  onVisualize: (colA: string, colB?: string) => void;
  recommendations?: Recommendation[];
}

export function TestsTab({
  cleaned,
  computed,
  results,
  canAdvancedTests,
  onSetResults,
  onVisualize: _onVisualize,
  recommendations = [],
}: Props) {
  const { addToCart, removeFromCart, cart } = useDataStore(
    useShallow((s) => ({
      addToCart: s.addToCart,
      removeFromCart: s.removeFromCart,
      cart: s.cart,
    })),
  );
  const statsLevel = usePrefsStore((s) => s.statsLevel);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [testWarnings, setTestWarnings] = React.useState<string[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentTest, setCurrentTest] = React.useState("");
  const [cartOpen, setCartOpen] = React.useState(false);
  const [vizChartType, setVizChartType] = React.useState<VizChartType>("auto");
  const [vizModalOpen, setVizModalOpen] = React.useState(false);
  const [testHighlights, setTestHighlights] = React.useState<TestHighlight[]>(
    [],
  );
  const [formulaCards, setFormulaCards] = React.useState<FormulaCard[]>([]);
  const [resultRecommendations, setResultRecommendations] = React.useState<
    ResultRecommendation[]
  >([]);
  const [activeTestGroup, setActiveTestGroup] =
    React.useState<TestGroup>("difference");
  const [activeTestKey, setActiveTestKey] =
    React.useState<TestKey>("mannWhitney");
  const [probeColA, setProbeColA] = React.useState("");
  const [probeColB, setProbeColB] = React.useState("");
  const [selectedTests, setSelectedTests] = React.useState<
    Record<TestKey, boolean>
  >({
    ...EMPTY_TEST_SELECTION,
    correlation: true,
    mannWhitney: true,
  });

  // Test config state
  const [corrMethod, setCorrMethod] = React.useState<"pearson" | "spearman">(
    "pearson",
  );
  const [testCol1, setTestCol1] = React.useState("");
  const [testCol2, setTestCol2] = React.useState("");
  const [tType, setTType] = React.useState<TTestType>("independent");
  const [tCol1, setTCol1] = React.useState("");
  const [tCol2, setTCol2] = React.useState("");
  const [tMu, setTMu] = React.useState(0);
  const [anovaY, setAnovaY] = React.useState("");
  const [anovaGroup, setAnovaGroup] = React.useState("");
  const [regY, setRegY] = React.useState("");
  const [regX, setRegX] = React.useState<string[]>([]);
  const [vifCols, setVifCols] = React.useState<string[]>([]);
  const [mwCol, setMwCol] = React.useState("");
  const [mwGroupCol, setMwGroupCol] = React.useState("");
  const [mwG1, setMwG1] = React.useState("");
  const [mwG2, setMwG2] = React.useState("");
  const [kwCol, setKwCol] = React.useState("");
  const [kwGroup, setKwGroup] = React.useState("");
  const [chiCol1, setChiCol1] = React.useState("");
  const [chiCol2, setChiCol2] = React.useState("");
  const [fisherCol1, setFisherCol1] = React.useState("");
  const [fisherCol2, setFisherCol2] = React.useState("");

  const isTestLocked = (tk: TestKey) =>
    !canAdvancedTests && ADVANCED_TEST_KEYS.includes(tk);

  const testHasResults = (tk: TestKey): boolean => {
    if (tk === "correlation") return !!results.correlation;
    if (tk === "kruskal") return (results.kruskalWallis?.length ?? 0) > 0;
    const key = tk as keyof StatsResults;
    const val = results[key];
    return Array.isArray(val) ? val.length > 0 : !!val;
  };

  // Sync selectedTests → global cart (only if test has results)
  React.useEffect(() => {
    for (const [tk, selected] of Object.entries(selectedTests) as [
      TestKey,
      boolean,
    ][]) {
      if (selected && testHasResults(tk)) {
        addToCart({
          id: `test-${tk}`,
          type: "test",
          label: TEST_META[tk].label,
          meta: { testKey: tk },
        });
      } else {
        removeFromCart(`test-${tk}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTests, results, addToCart, removeFromCart]);

  const cartCount = cart.length;
  const categoricalCols = cleaned.columns
    .filter((c) => c.type === "categorical")
    .map((c) => c.name);
  const columnTypeMap = Object.fromEntries(
    cleaned.columns.map((c) => [c.name, c.type]),
  );

  const groupValuesFor = React.useCallback(
    (groupCol: string) => {
      if (!groupCol) return [];
      const seen = new Set<string>();
      for (const r of cleaned.rows) {
        const v = r[groupCol];
        if (v != null && v !== "") seen.add(String(v));
        if (seen.size > 200) break; // cap to prevent lag on high-cardinality columns
      }
      return [...seen];
    },
    [cleaned.rows],
  );

  React.useEffect(() => {
    if (!canAdvancedTests) {
      setSelectedTests((prev) => {
        const next = { ...prev };
        ADVANCED_TEST_KEYS.forEach((key) => {
          next[key] = false;
        });
        return next;
      });
      if (ADVANCED_TEST_KEYS.includes(activeTestKey))
        setActiveTestKey("correlation");
      if (activeTestGroup === "advanced") setActiveTestGroup("difference");
    }
  }, [canAdvancedTests, activeTestGroup, activeTestKey]);

  React.useEffect(() => {
    if (!probeColA && cleaned.columns[0]?.name)
      setProbeColA(cleaned.columns[0].name);
    if (!probeColB) {
      const fallback =
        cleaned.columns[1]?.name ?? cleaned.columns[0]?.name ?? "";
      if (fallback) setProbeColB(fallback);
    }
  }, [cleaned.columns, probeColA, probeColB]);

  const sharedColumns = [probeColA, probeColB].filter(Boolean);
  const preferredNumericCols = Array.from(
    new Set([
      ...sharedColumns.filter((col) => columnTypeMap[col] === "numeric"),
      ...computed.numericCols,
    ]),
  );
  const preferredCategoricalCols = Array.from(
    new Set([
      ...sharedColumns.filter((col) => columnTypeMap[col] === "categorical"),
      ...categoricalCols,
    ]),
  );

  const corrColA = testCol1 || preferredNumericCols[0] || "";
  const corrColB =
    testCol2 ||
    preferredNumericCols.find((col) => col !== corrColA) ||
    preferredNumericCols[1] ||
    "";
  const displayTCol1 = tCol1 || preferredNumericCols[0] || "";
  const displayTCol2 =
    tCol2 ||
    preferredNumericCols.find((col) => col !== displayTCol1) ||
    preferredNumericCols[1] ||
    "";
  const displayAnovaY = anovaY || preferredNumericCols[0] || "";
  const displayAnovaGroup = anovaGroup || preferredCategoricalCols[0] || "";
  const displayRegY = regY || preferredNumericCols[0] || "";
  const displayRegX =
    regX.length > 0
      ? regX
      : preferredNumericCols.filter((col) => col !== displayRegY).slice(0, 2);
  const displayVifCols =
    vifCols.length > 0 ? vifCols : preferredNumericCols.slice(0, 3);
  const displayMwCol = mwCol || preferredNumericCols[0] || "";
  const displayMwGroupCol = mwGroupCol || preferredCategoricalCols[0] || "";
  const displayMwGroups = groupValuesFor(displayMwGroupCol);
  const displayMwG1 = mwG1 || displayMwGroups[0] || "";
  const displayMwG2 =
    mwG2 ||
    displayMwGroups.find((g) => g !== displayMwG1) ||
    displayMwGroups[1] ||
    "";
  const displayKwCol = kwCol || preferredNumericCols[0] || "";
  const displayKwGroup = kwGroup || preferredCategoricalCols[0] || "";
  const displayChiCol1 = chiCol1 || preferredCategoricalCols[0] || "";
  const displayChiCol2 =
    chiCol2 ||
    preferredCategoricalCols.find((col) => col !== displayChiCol1) ||
    preferredCategoricalCols[1] ||
    "";
  const displayFisherCol1 = fisherCol1 || preferredCategoricalCols[0] || "";
  const displayFisherCol2 =
    fisherCol2 ||
    preferredCategoricalCols.find((col) => col !== displayFisherCol1) ||
    preferredCategoricalCols[1] ||
    "";

  const recommendation = React.useMemo(() => {
    const a = probeColA || cleaned.columns[0]?.name || "";
    const b = probeColB || cleaned.columns[1]?.name || "";

    if (!a || !b) {
      return {
        id: "correlation",
        label: "Correlation",
        reason: "Choose two columns to get a recommendation.",
      };
    }

    const match = recommendations.find(
      (r) => r.id === `rec_test_${a}_${b}` || r.id === `rec_test_${b}_${a}`,
    );

    if (match) {
      const text = match.action.toLowerCase();
      let id = "correlation";
      let label = "Correlation";

      if (
        text.includes("pearson") ||
        text.includes("spearman") ||
        text.includes("correlation")
      ) {
        id = "correlation";
        label = text.includes("spearman")
          ? "Spearman Correlation"
          : "Pearson Correlation";
      } else if (text.includes("t-test")) {
        id = "tTest";
        label = "Independent t-test";
      } else if (text.includes("mann-whitney")) {
        id = "mann-whitney";
        label = "Mann-Whitney U";
      } else if (text.includes("anova")) {
        id = "anova";
        label = "One-way ANOVA";
      } else if (text.includes("kruskal")) {
        id = "kruskal";
        label = "Kruskal-Wallis";
      } else if (text.includes("chi-square")) {
        id = "chi-square";
        label = "Chi-square of Independence";
      } else if (text.includes("fisher")) {
        id = "fisher";
        label = "Fisher's Exact Test";
      }

      return {
        id,
        label,
        reason: `${match.reason} ${match.action}`,
      };
    }

    return {
      id: "correlation",
      label: "Correlation",
      reason: "Use with two numeric columns.",
    };
  }, [probeColA, probeColB, cleaned.columns, recommendations]);

  const recommendationTestKey: TestKey =
    (
      {
        correlation: "correlation",
        tTest: "tTest",
        "mann-whitney": "mannWhitney",
        kruskal: "kruskal",
        "chi-square": "chiSquare",
        fisher: "fisher",
        anova: "anova",
      } as Record<string, TestKey>
    )[recommendation.id] ?? "correlation";

  const selectedPairSummary =
    probeColA && probeColB
      ? `${humanizeColumnType(columnTypeMap[probeColA])} (${formatColumnLabel(probeColA)}) vs ${humanizeColumnType(columnTypeMap[probeColB])} (${formatColumnLabel(probeColB)})`
      : "Choose two variables to auto-detect the best test.";

  const baseResults = {
    descriptive: computed.descriptive,
    frequencies: computed.frequencies,
    correlation: computed.correlation,
    normality: computed.normality,
    tTests: results.tTests,
    anova: results.anova,
    regression: results.regression,
    mannWhitney: results.mannWhitney,
    kruskalWallis: results.kruskalWallis,
    chiSquare: results.chiSquare,
  };

  // Builder context
  const builderCtx: BuilderContext = React.useMemo(
    () => ({
      rows: cleaned.rows,
      columnTypeMap,
      groupValuesFor,
    }),
    [cleaned.rows, columnTypeMap, groupValuesFor],
  );

  const runConfiguredTests = async (selection: Record<TestKey, boolean>) => {
    setTestError(null);
    setIsRunning(true);
    setCurrentTest("");
    setTestWarnings([]);

    // Storage-backed test runs (backend parses the raw file instead of the
    // client shipping full rows). Only safe when NO cleaning config is active —
    // with cleaning, rows-mode guarantees the server sees exactly what the UI
    // shows. The metadata lookup is cached per session.
    const sbCtx = getStorageBackedContext();
    const storageBacked = sbCtx ? await resolveStorageBacked(sbCtx) : null;

    const outcome = await runConfiguredTestsCore({
      selection,
      canAdvancedTests,
      cleaned,
      builderCtx,
      baseResults,
      corrColA,
      corrColB,
      corrMethod,
      tType,
      displayTCol1,
      displayTCol2,
      tMu,
      tCol2,
      anovaGroup,
      regX,
      vifCols,
      mwGroupCol,
      kwGroup,
      chiCol1,
      fisherCol1,
      displayAnovaY,
      displayAnovaGroup,
      displayRegY,
      displayRegX,
      displayVifCols,
      displayMwCol,
      displayMwGroupCol,
      displayMwG1,
      displayMwG2,
      displayKwCol,
      displayKwGroup,
      displayChiCol1,
      displayChiCol2,
      displayFisherCol1,
      displayFisherCol2,
      groupValuesFor,
      onCurrentTest: setCurrentTest,
      storageBacked,
    });
    if (outcome.blocked) {
      setTestError(outcome.error);
      setIsRunning(false);
      return;
    }
    setTestWarnings(outcome.warnings);
    onSetResults(outcome.next);
    setTestHighlights(outcome.highlights);
    setFormulaCards(outcome.formulas);
    setResultRecommendations(outcome.resultRecommendations);
    setTestError(outcome.error);
    setCurrentTest("");
    setIsRunning(false);
  };

  const runAllSelectedTests = () => {
    void runConfiguredTests(selectedTests);
  };
  const runSingleTest = (tk: TestKey) => {
    void runConfiguredTests({ ...EMPTY_TEST_SELECTION, [tk]: true });
  };

  const applyRecommendation = () => {
    const a = probeColA || cleaned.columns[0]?.name || "";
    const b = probeColB || cleaned.columns[1]?.name || "";
    if (!a || !b) return;
    const rk: TestKey = recommendationTestKey;
    if (isTestLocked(rk)) {
      setTestError(
        "This recommended test is available on Member and Premium plans.",
      );
      return;
    }
    setActiveTestKey(rk);
    setActiveTestGroup(TEST_META[rk].group);
    if (recommendation.id === "correlation") {
      setCorrMethod(
        recommendation.label.toLowerCase().includes("spearman")
          ? "spearman"
          : "pearson",
      );
      setTestCol1(a);
      setTestCol2(b);
      setSelectedTests((prev) => ({ ...prev, correlation: true }));
      return;
    }
    if (recommendation.id === "tTest") {
      const numCol = columnTypeMap[a] === "numeric" ? a : b;
      const numCol2 = columnTypeMap[a] === "numeric" ? b : a;
      setTType("independent");
      setTCol1(numCol);
      setTCol2(numCol2);
      setSelectedTests((prev) => ({ ...prev, tTest: true }));
      return;
    }
    if (recommendation.id === "mann-whitney") {
      const numCol = columnTypeMap[a] === "numeric" ? a : b;
      const gc = columnTypeMap[a] === "categorical" ? a : b;
      const gs = groupValuesFor(gc);
      setMwCol(numCol);
      setMwGroupCol(gc);
      setMwG1(gs[0] ?? "");
      setMwG2(gs[1] ?? "");
      setSelectedTests((prev) => ({ ...prev, mannWhitney: true }));
      return;
    }
    if (recommendation.id === "kruskal") {
      const numCol = columnTypeMap[a] === "numeric" ? a : b;
      const gc = columnTypeMap[a] === "categorical" ? a : b;
      setKwCol(numCol);
      setKwGroup(gc);
      setSelectedTests((prev) => ({ ...prev, kruskal: true }));
      return;
    }
    if (recommendation.id === "anova") {
      const numCol = columnTypeMap[a] === "numeric" ? a : b;
      const gc = columnTypeMap[a] === "categorical" ? a : b;
      setAnovaY(numCol);
      setAnovaGroup(gc);
      setSelectedTests((prev) => ({ ...prev, anova: true }));
      return;
    }
    if (recommendation.id === "fisher") {
      setFisherCol1(a);
      setFisherCol2(b);
      setSelectedTests((prev) => ({ ...prev, fisher: true }));
      return;
    }
    if (recommendation.id === "chi-square") {
      setChiCol1(a);
      setChiCol2(b);
      setSelectedTests((prev) => ({ ...prev, chiSquare: true }));
    }
  };

  const selectedTestCount = Object.values(selectedTests).filter(Boolean).length;

  const activeTestDerived = computeActiveTestDerived({
    activeTestKey,
    corrColA,
    corrColB,
    corrMethod,
    displayTCol1,
    displayTCol2,
    tType,
    tMu,
    displayAnovaY,
    displayAnovaGroup,
    displayRegY,
    displayRegX,
    displayVifCols,
    displayMwCol,
    displayMwGroupCol,
    displayMwG1,
    displayMwG2,
    displayKwCol,
    displayKwGroup,
    displayChiCol1,
    displayChiCol2,
    displayFisherCol1,
    displayFisherCol2,
    columnTypeMap,
  });

  const activeTestCard = useActiveTestCard({
    activeTestKey,
    computed,
    categoricalCols,
    corrMethod,
    setCorrMethod,
    corrColA,
    setTestCol1,
    corrColB,
    setTestCol2,
    tType,
    setTType,
    displayTCol1,
    setTCol1,
    displayTCol2,
    setTCol2,
    tMu,
    setTMu,
    displayAnovaY,
    setAnovaY,
    displayAnovaGroup,
    setAnovaGroup,
    displayRegY,
    setRegY,
    displayRegX,
    setRegX,
    displayVifCols,
    setVifCols,
    displayMwGroupCol,
    setMwGroupCol,
    setMwG1,
    setMwG2,
    displayMwCol,
    setMwCol,
    displayMwGroups,
    displayMwG1,
    setMwG1Value: setMwG1,
    displayMwG2,
    setMwG2Value: setMwG2,
    displayKwGroup,
    setKwGroup,
    displayKwCol,
    setKwCol,
    displayChiCol1,
    setChiCol1,
    displayChiCol2,
    setChiCol2,
    displayFisherCol1,
    setFisherCol1,
    displayFisherCol2,
    setFisherCol2,
  });

  return (
    <div className="analyse-tab-body tests-tab-body">
      <TestRecommendation
        cleaned={cleaned}
        probeColA={probeColA}
        setProbeColA={setProbeColA}
        probeColB={probeColB}
        setProbeColB={setProbeColB}
        recommendation={recommendation}
        selectedPairSummary={selectedPairSummary}
        applyRecommendation={applyRecommendation}
      />

      <div className="tests-builder">
        <TestsConfigPanel
          statsLevel={statsLevel}
          activeTestKey={activeTestKey}
          setActiveTestKey={setActiveTestKey}
          setActiveTestGroup={setActiveTestGroup}
          setTestError={setTestError}
          isTestLocked={isTestLocked}
          selectedTests={selectedTests}
          setSelectedTests={setSelectedTests}
          testHasResults={testHasResults}
          configCard={activeTestCard}
          activeTestSummary={activeTestDerived.summary}
          testWarnings={testWarnings}
          testError={testError}
          isRunning={isRunning}
          currentTest={currentTest}
          activeTestCanRun={activeTestDerived.canRun}
          runSingleTest={runSingleTest}
          disabledReason={activeTestDerived.disabledReason}
          autoVizCols={activeTestDerived.autoVizCols}
          vizModalOpen={vizModalOpen}
          setVizModalOpen={setVizModalOpen}
          vizChartType={vizChartType}
          setVizChartType={setVizChartType}
          cleaned={cleaned}
          testHighlights={testHighlights}
          formulaCards={formulaCards}
          resultRecommendations={resultRecommendations}
        />
        <TestsCart
          cart={cart}
          cartCount={cartCount}
          testHighlights={testHighlights}
          formulaCards={formulaCards}
          resultRecommendations={resultRecommendations}
          removeFromCart={removeFromCart}
          setSelectedTests={setSelectedTests}
        />
      </div>
      <TestsCartMobile
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        cart={cart}
        cartCount={cartCount}
        testHighlights={testHighlights}
        removeFromCart={removeFromCart}
        setSelectedTests={setSelectedTests}
        runAllSelectedTests={runAllSelectedTests}
        selectedTestCount={selectedTestCount}
      />
    </div>
  );
}

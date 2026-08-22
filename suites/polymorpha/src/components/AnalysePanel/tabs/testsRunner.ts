import { callStatsApi, callStatsApiWithPath } from "@/lib/stats/api";
import { sanitizeStatsError } from "@/lib/errors/sanitize";
import { recommendations as fetchRecommendations } from "@/lib/stats/tests";
import type { Recommendation as ResultRecommendation } from "@/lib/stats/tests";
import { fmtNum } from "@/store/usePrefsStore";
import type {
  AnovaResult,
  ChiSquareResult,
  Dataset,
  KruskalWallisResult,
  MannWhitneyResult,
  RegressionResult,
  StatsResults,
  TTestResult,
  TTestType,
} from "@/types";
import type {
  TestKey,
  TestHighlight,
} from "@/components/AnalysePanel/analyseHelpers";
import {
  buildAnova,
  buildBinomial,
  buildChiSquare,
  buildCorrelation,
  buildFisher,
  buildFriedman,
  buildKendallTau,
  buildKruskal,
  buildLevene,
  buildLogisticRegression,
  buildMannWhitney,
  buildRegression,
  buildTost,
  buildTTest,
  buildTwoWayAnova,
  buildVif,
  buildWelchAnova,
  MethodologyValidator,
} from "@polymorpha/business-logic";
import type { BuilderContext } from "@polymorpha/business-logic";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasProp<K extends string>(
  obj: UnknownRecord,
  key: K,
): obj is UnknownRecord & Record<K, unknown> {
  return key in obj;
}

export interface FormulaCard {
  name: string;
  formula: string;
  substituted: string;
  result: string;
}

export interface RunTestsOutcome {
  blocked: boolean;
  error: string | null;
  warnings: string[];
  highlights: TestHighlight[];
  formulas: FormulaCard[];
  next: StatsResults;
  resultRecommendations: ResultRecommendation[];
}

export interface RunTestsParams {
  selection: Record<TestKey, boolean>;
  canAdvancedTests: boolean;
  cleaned: Dataset;
  builderCtx: BuilderContext;
  baseResults: StatsResults;
  corrColA: string;
  corrColB: string;
  corrMethod: "pearson" | "spearman";
  tType: TTestType;
  displayTCol1: string;
  displayTCol2: string;
  tMu: number;
  tCol2: string;
  anovaGroup: string;
  regX: string[];
  vifCols: string[];
  mwGroupCol: string;
  kwGroup: string;
  chiCol1: string;
  fisherCol1: string;
  displayAnovaY: string;
  displayAnovaGroup: string;
  displayRegY: string;
  displayRegX: string[];
  displayVifCols: string[];
  displayMwCol: string;
  displayMwGroupCol: string;
  displayMwG1: string;
  displayMwG2: string;
  displayKwCol: string;
  displayKwGroup: string;
  displayChiCol1: string;
  displayChiCol2: string;
  displayFisherCol1: string;
  displayFisherCol2: string;
  groupValuesFor: (col: string) => string[];
  onCurrentTest: (label: string) => void;
  /**
   * When set (only for un-cleaned datasets — see TestsTab), tests run
   * storage-backed: the backend parses the raw file instead of receiving
   * the full rows in the request body.
   */
  storageBacked?: { storagePath: string; contentHash?: string } | null;
}

export async function runConfiguredTests(
  params: RunTestsParams,
): Promise<RunTestsOutcome> {
  const {
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
    onCurrentTest,
    storageBacked,
  } = params;

  const runStat = (req: {
    action: string;
    payload: Record<string, unknown>;
  }) =>
    storageBacked
      ? callStatsApiWithPath(
          req.action,
          storageBacked.storagePath,
          null,
          req.payload,
          { contentHash: storageBacked.contentHash },
        )
      : callStatsApi(
          req.action,
          req.payload.rows as Array<Record<string, unknown>>,
          req.payload,
        );

  const eff = canAdvancedTests
    ? selection
    : {
        ...selection,
        anova: false,
        welchAnova: false,
        levene: false,
        regression: false,
        vif: false,
        mannWhitney: false,
        kruskal: false,
        fisher: false,
      };

  const effUnknown: unknown = eff;

  const allBlocks: string[] = [];
  const allWarnings: string[] = [];

  // --- Methodology Validation (Phase 2) ---
  const validateMethod = (
    methodName: string,
    mapping: Record<string, string>,
  ) => {
    const res = MethodologyValidator.validate(methodName, cleaned, mapping);
    if (res.blocks.length > 0) allBlocks.push(...res.blocks);
    if (res.warnings.length > 0) allWarnings.push(...res.warnings);
  };

  if (eff.correlation)
    validateMethod("Pearson / Spearman Correlation", {
      predictors: `${corrColA},${corrColB}`,
    });
  if (eff.tTest) {
    if (tType === "independent")
      validateMethod("Independent t-test (Welch's)", { groupCol: tCol2 });
    if (tType === "paired") validateMethod("Paired t-test", {});
    if (tType === "one-sample") validateMethod("One-sample t-test", {});
  }
  if (eff.anova)
    validateMethod("One-way ANOVA (with Tukey HSD)", { groupCol: anovaGroup });
  if (eff.welchAnova) validateMethod("Welch's ANOVA", { groupCol: anovaGroup });
  if (eff.levene) validateMethod("Levene's test", { groupCol: anovaGroup });
  if (eff.regression)
    validateMethod("OLS Multiple Regression", { predictors: regX.join(",") });
  if (eff.vif)
    validateMethod("VIF / Durbin-Watson / Condition No.", {
      predictors: vifCols.join(","),
    });
  if (eff.mannWhitney)
    validateMethod("Mann-Whitney U", { groupCol: mwGroupCol });
  if (eff.kruskal)
    validateMethod("Kruskal-Wallis H (with Dunn's)", { groupCol: kwGroup });
  if (eff.chiSquare) validateMethod("Chi-square", { category: chiCol1 });
  if (eff.fisher) validateMethod("Fisher's Exact", { category: fisherCol1 });

  if (allBlocks.length > 0) {
    return {
      blocked: true,
      error: allBlocks.join(" | "),
      warnings: [],
      highlights: [],
      formulas: [],
      next: baseResults,
      resultRecommendations: [],
    };
  }

  const next = { ...baseResults };
  const errors: string[] = [];
  const highlights: TestHighlight[] = [];
  const fmt = (v: number | undefined, _digits?: number) => fmtNum(v as number);
  const statOrDash = (v: number | undefined, digits = 3): string =>
    typeof v === "number" && isFinite(v) ? fmt(v, digits) : "\u2014";

  interface TestTask {
    label: string;
    run: () => Promise<void>;
  }
  const tasks: TestTask[] = [];

  if (eff.correlation)
    tasks.push({
      label: "Correlation",
      run: async () => {
        const req = buildCorrelation(builderCtx, {
          colA: corrColA,
          colB: corrColB,
          method: corrMethod,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res)) throw new Error("Correlation: invalid response");
        const c1 = typeof res.c1 === "string" ? res.c1 : "";
        const c2 = typeof res.c2 === "string" ? res.c2 : "";
        const r = typeof res.r === "number" ? res.r : NaN;
        highlights.push({
          name:
            corrMethod === "pearson"
              ? "Pearson Correlation"
              : "Spearman Correlation",
          metric: !isFinite(r) ? "r = N/A" : `r = ${fmtNum(r)}`,
          detail: `${c1} vs ${c2}`,
          tone: isFinite(r) && Math.abs(r) >= 0.7 ? "sig" : "info",
        });
      },
    });
  if (eff.tTest)
    tasks.push({
      label: "t-test",
      run: async () => {
        const req = buildTTest(builderCtx, {
          col1: displayTCol1,
          col2: displayTCol2,
          type: tType,
          mu: tMu,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("t-test: invalid response");
        next.tTests = [res as unknown as TTestResult];
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const tVal = typeof res.t === "number" ? res.t : undefined;
        const typeStr = typeof res.type === "string" ? res.type : "";
        const significant = res.significant === true;
        highlights.push({
          name: "t-test",
          metric: `p = ${fmt(pValue)}`,
          detail: `t = ${statOrDash(tVal)} (${typeStr})`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.anova)
    tasks.push({
      label: "ANOVA",
      run: async () => {
        const req = buildAnova(builderCtx, {
          responseCol: displayAnovaY,
          groupCol: displayAnovaGroup,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("ANOVA: invalid response");
        next.anova = [res as unknown as AnovaResult];
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const fVal = typeof res.F === "number" ? res.F : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "ANOVA",
          metric: `p = ${fmt(pValue)}`,
          detail: `F = ${statOrDash(fVal)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.regression)
    tasks.push({
      label: "Regression",
      run: async () => {
        const req = buildRegression(builderCtx, {
          responseCol: displayRegY,
          predictors: displayRegX,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.rSquared !== "number")
          throw new Error("Regression: invalid response");
        next.regression = [res as unknown as RegressionResult];
        const rSquared =
          typeof res.rSquared === "number" ? res.rSquared : undefined;
        const fPValue =
          typeof res.fPValue === "number" ? res.fPValue : undefined;
        const tone =
          typeof fPValue === "number" && fPValue < 0.05 ? "sig" : "info";
        highlights.push({
          name: "Regression",
          metric: `R\u00B2 = ${fmt(rSquared)}`,
          detail: `F p = ${fmt(fPValue)}`,
          tone,
        });
      },
    });
  if (eff.vif)
    tasks.push({
      label: "VIF",
      run: async () => {
        const req = buildVif(builderCtx, { cols: displayVifCols });
        const res: unknown = await runStat(req);
        if (!isRecord(res)) throw new Error("VIF: invalid response");
        const vifObj: UnknownRecord = isRecord(res.vif) ? res.vif : {};
        const vifVals = Object.values(vifObj).filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
        const maxVif = vifVals.length > 0 ? Math.max(...vifVals) : 0;
        const flaggedRaw = Array.isArray(res.flagged) ? res.flagged : [];
        const flagged = flaggedRaw.filter(
          (v): v is string => typeof v === "string",
        );
        highlights.push({
          name: "VIF",
          metric: `max = ${fmt(maxVif, 2)}`,
          detail:
            flagged.length > 0
              ? `Flagged: ${flagged.join(", ")}`
              : "No collinearity detected",
          tone: flagged.length > 0 ? "sig" : "nonsig",
        });
      },
    });
  if (eff.mannWhitney)
    tasks.push({
      label: "Mann-Whitney",
      run: async () => {
        const req = buildMannWhitney(builderCtx, {
          numCol: displayMwCol,
          groupCol: displayMwGroupCol,
          g1: displayMwG1,
          g2: displayMwG2,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Mann-Whitney: invalid response");
        next.mannWhitney = [res as unknown as MannWhitneyResult];
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const uVal = typeof res.U === "number" ? res.U : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Mann-Whitney U",
          metric: `p = ${fmt(pValue)}`,
          detail: `U = ${statOrDash(uVal)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.kruskal)
    tasks.push({
      label: "Kruskal-Wallis",
      run: async () => {
        const req = buildKruskal(builderCtx, {
          numCol: displayKwCol,
          groupCol: displayKwGroup,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Kruskal-Wallis: invalid response");
        next.kruskalWallis = [res as unknown as KruskalWallisResult];
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const hVal = typeof res.H === "number" ? res.H : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Kruskal-Wallis",
          metric: `p = ${fmt(pValue)}`,
          detail: `H = ${statOrDash(hVal)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.chiSquare)
    tasks.push({
      label: "Chi-square",
      run: async () => {
        const req = buildChiSquare(builderCtx, {
          col1: displayChiCol1,
          col2: displayChiCol2,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Chi-square: invalid response");
        next.chiSquare = [res as unknown as ChiSquareResult];
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const cramersV =
          typeof res.cramersV === "number" ? res.cramersV : undefined;
        const lowExpectedWarning = res.lowExpectedWarning === true;
        const significant = res.significant === true;
        highlights.push({
          name: "Chi-square",
          metric: `p = ${fmt(pValue)}`,
          detail: `V = ${fmt(cramersV, 3)}${
            lowExpectedWarning ? " (low expected freq.)" : ""
          }`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.fisher)
    tasks.push({
      label: "Fisher's Exact",
      run: async () => {
        const req = buildFisher(builderCtx, {
          col1: displayFisherCol1,
          col2: displayFisherCol2,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Fisher's Exact: invalid response");
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const oddsRatio =
          typeof res.oddsRatio === "number" ? res.oddsRatio : NaN;
        const significant = res.significant === true;
        highlights.push({
          name: "Fisher's Exact",
          metric: `p = ${fmt(pValue)}`,
          detail: `OR = ${
            Number.isFinite(oddsRatio) ? fmtNum(oddsRatio) : "\u221E"
          }`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.levene)
    tasks.push({
      label: "Levene's Test",
      run: async () => {
        const req = buildLevene(builderCtx, {
          responseCol: displayAnovaY,
          groupCol: displayAnovaGroup,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Levene's Test: invalid response");
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const equalVariances = res.equalVariances === true;
        const significant = res.significant === true;
        highlights.push({
          name: "Levene's Test",
          metric: `p = ${fmt(pValue)}`,
          detail: equalVariances ? "Equal variances" : "Unequal variances",
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (eff.welchAnova)
    tasks.push({
      label: "Welch's ANOVA",
      run: async () => {
        const req = buildWelchAnova(builderCtx, {
          responseCol: displayAnovaY,
          groupCol: displayAnovaGroup,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Welch's ANOVA: invalid response");
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const fVal = typeof res.F === "number" ? res.F : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Welch's ANOVA",
          metric: `p = ${fmt(pValue)}`,
          detail: `F = ${statOrDash(fVal)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });

  // ── Extended inferential tests (filtered) ──
  const numericCols = cleaned.columns
    .filter((c) => c.type === "numeric")
    .map((c) => c.name);
  const catCols = cleaned.columns
    .filter((c) => c.type === "categorical")
    .map((c) => c.name);
  const firstNum = numericCols[0] ?? displayAnovaY;
  const firstCat = catCols[0] ?? displayChiCol1;
  const secondCat = catCols[1] ?? displayChiCol2 ?? firstCat;
  const fallbackCols =
    displayVifCols.length >= 2 ? displayVifCols : numericCols.slice(0, 3);
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "kendallTau") &&
    effUnknown.kendallTau === true
  )
    tasks.push({
      label: "Kendall's Tau",
      run: async () => {
        const req = buildKendallTau(builderCtx, {
          colA: corrColA ?? firstNum,
          colB: corrColB ?? numericCols[1] ?? firstNum,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Kendall's Tau: invalid response");
        const tauVal =
          typeof res.tau === "number"
            ? res.tau
            : typeof res.r === "number"
              ? res.r
              : undefined;
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Kendall's Tau",
          metric: `τ = ${fmt(tauVal)}`,
          detail: `p = ${fmt(pValue)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "wilcoxon") &&
    effUnknown.wilcoxon === true
  )
    tasks.push({
      label: "Wilcoxon",
      run: async () => {
        const req = {
          action: "wilcoxon",
          payload: {
            rows: cleaned.rows,
            col1: numericCols[0] ?? firstNum,
            col2: numericCols[1] ?? numericCols[0] ?? firstNum,
          },
        };
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Wilcoxon: invalid response");
        const wVal =
          typeof res.W === "number"
            ? res.W
            : typeof res.statistic === "number"
              ? res.statistic
              : undefined;
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Wilcoxon Signed-Rank",
          metric: `W = ${fmt(wVal)}`,
          detail: `p = ${fmt(pValue)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "tost") &&
    effUnknown.tost === true
  )
    tasks.push({
      label: "TOST",
      run: async () => {
        const req = buildTost(builderCtx, {
          col: firstNum,
          low: -0.5,
          high: 0.5,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("TOST: invalid response");
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const equivalent = res.equivalent === true;
        highlights.push({
          name: "TOST",
          metric: `p = ${fmt(pValue)}`,
          detail: equivalent ? "Equivalent" : "Not equivalent",
          tone: equivalent ? "sig" : "nonsig",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "binomial") &&
    effUnknown.binomial === true
  )
    tasks.push({
      label: "Binomial",
      run: async () => {
        const req = buildBinomial(builderCtx, { col: firstCat });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Binomial: invalid response");
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const kVal = typeof res.k === "number" ? res.k : "?";
        const nVal = typeof res.n === "number" ? res.n : "?";
        const significant = res.significant === true;
        highlights.push({
          name: "Binomial",
          metric: `p = ${fmt(pValue)}`,
          detail: `${kVal}/${nVal}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "twoWayAnova") &&
    effUnknown.twoWayAnova === true
  )
    tasks.push({
      label: "Two-way ANOVA",
      run: async () => {
        const req = buildTwoWayAnova(builderCtx, {
          responseCol: firstNum,
          factorA: firstCat,
          factorB: secondCat,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res)) throw new Error("Two-way ANOVA: invalid response");
        const factorA = isRecord(res.factor_a) ? res.factor_a : null;
        const factorB = isRecord(res.factor_b) ? res.factor_b : null;
        const pA =
          factorA && typeof factorA.pValue === "number"
            ? factorA.pValue
            : undefined;
        const pB =
          factorB && typeof factorB.pValue === "number"
            ? factorB.pValue
            : undefined;
        highlights.push({
          name: "Two-way ANOVA",
          metric: `pA = ${fmt(pA)}`,
          detail: `FB p = ${fmt(pB)}`,
          tone: "info",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "friedman") &&
    effUnknown.friedman === true
  )
    tasks.push({
      label: "Friedman",
      run: async () => {
        const cols =
          numericCols.slice(0, 3).length >= 3
            ? numericCols.slice(0, 3)
            : fallbackCols.slice(0, 3);
        const req = buildFriedman(builderCtx, { columns: cols });
        const res: unknown = await runStat(req);
        if (!isRecord(res) || typeof res.pValue !== "number")
          throw new Error("Friedman: invalid response");
        const chi2 = typeof res.chi2 === "number" ? res.chi2 : undefined;
        const pValue = typeof res.pValue === "number" ? res.pValue : undefined;
        const significant = res.significant === true;
        highlights.push({
          name: "Friedman",
          metric: `χ² = ${statOrDash(chi2)}`,
          detail: `p = ${fmt(pValue)}`,
          tone: significant ? "sig" : "nonsig",
        });
      },
    });
  if (
    isRecord(effUnknown) &&
    hasProp(effUnknown, "logisticRegression") &&
    effUnknown.logisticRegression === true
  )
    tasks.push({
      label: "Logistic",
      run: async () => {
        const target = catCols[0] ?? firstCat;
        const preds = numericCols.slice(0, 2);
        const req = buildLogisticRegression(builderCtx, {
          target,
          predictors: preds,
        });
        const res: unknown = await runStat(req);
        if (!isRecord(res)) throw new Error("Logistic: invalid response");
        const auc = typeof res.auc === "number" ? res.auc : undefined;
        const pValue =
          typeof res.pValue === "number" ? res.pValue : undefined;
        highlights.push({
          name: "Logistic",
          metric: `AUC = ${fmt(auc)}`,
          detail: `p = ${fmt(pValue)}`,
          tone: "info",
        });
      },
    });

  // Generic catch-all for remaining inferential extensions
  const genericParity: Array<{ key: TestKey; label: string; action: string }> =
    [
      {
        key: "partialCorrelation" as TestKey,
        label: "Partial Corr",
        action: "partialCorrelation",
      },
      {
        key: "pointBiserial" as TestKey,
        label: "Point-Biserial",
        action: "pointBiserial",
      },
      {
        key: "ridgeRegression" as TestKey,
        label: "Ridge",
        action: "ridgeRegression",
      },
      {
        key: "lassoRegression" as TestKey,
        label: "Lasso",
        action: "lassoRegression",
      },
      {
        key: "moderation" as TestKey,
        label: "Moderation",
        action: "moderation",
      },
      { key: "mediation" as TestKey, label: "Mediation", action: "mediation" },
      {
        key: "repeatedAnova" as TestKey,
        label: "Repeated ANOVA",
        action: "repeatedAnova",
      },
      { key: "mcnemar" as TestKey, label: "McNemar", action: "mcnemar" },
      {
        key: "gofChisquare" as TestKey,
        label: "GOF Chi²",
        action: "gofChisquare",
      },
    ];
  for (const { key, label, action } of genericParity) {
    if (
      isRecord(effUnknown) &&
      hasProp(effUnknown, key) &&
      Boolean(effUnknown[key])
    ) {
      tasks.push({
        label,
        run: async () => {
          const payload: Record<string, unknown> = { rows: cleaned.rows };
          if (action === "partialCorrelation") {
            payload["colA"] = numericCols[0] ?? firstNum;
            payload["colB"] = numericCols[1] ?? numericCols[0] ?? firstNum;
            payload["control"] = numericCols[2] ?? numericCols[0] ?? firstNum;
            // also send aliases for backend flexibility
            payload["x"] = payload["colA"];
            payload["y"] = payload["colB"];
            payload["z"] = payload["control"];
          } else if (action === "pointBiserial") {
            payload["catCol"] = firstCat;
            payload["numCol"] = firstNum;
            payload["col1"] = firstCat;
            payload["col2"] = firstNum;
            payload["column"] = firstNum;
          } else if (["ridgeRegression", "lassoRegression"].includes(action)) {
            payload["target"] = numericCols[0] ?? firstNum;
            payload["predictors"] = numericCols.slice(1, 3);
            payload["cols"] = payload["predictors"];
          } else if (action === "moderation") {
            payload["target"] = numericCols[0] ?? firstNum;
            payload["predictor"] = numericCols[1] ?? firstNum;
            payload["moderator"] = numericCols[2] ?? catCols[0] ?? firstCat;
            payload["col1"] = payload["predictor"];
            payload["col2"] = payload["moderator"];
          } else if (action === "mediation") {
            payload["target"] = numericCols[0] ?? firstNum;
            payload["predictor"] = numericCols[1] ?? firstNum;
            payload["mediator"] = numericCols[2] ?? firstNum;
          } else if (action === "repeatedAnova") {
            payload["valueCol"] = firstNum;
            payload["subjectCol"] = firstCat;
            payload["withinCol"] = secondCat;
          } else if (action === "gofChisquare") {
            // Binomial.gof_chisquare expects a single `col`, not col1/col2.
            payload["col"] = firstCat;
            payload["column"] = firstCat;
          } else {
            // mcnemar — col1/col2 categorical pair
            payload["columns"] = numericCols.slice(0, 2);
            payload["col1"] = firstCat;
            payload["col2"] = secondCat;
          }
          const res: unknown = await callStatsApi(
            action,
            cleaned.rows,
            payload,
          );
          if (!isRecord(res))
            throw new Error(`${label}: invalid response`);
          const pValue =
            typeof res.pValue === "number"
              ? res.pValue
              : typeof res.p === "number"
                ? res.p
                : 0;
          highlights.push({
            name: label,
            metric: `p = ${fmt(pValue)}`,
            detail: action,
            tone: "info",
          });
        },
      });
    }
  }

  for (let i = 0; i < tasks.length; i += 3) {
    const batch = tasks.slice(i, i + 3);
    await Promise.all(
      batch.map((task) =>
        (async () => {
          onCurrentTest(task.label);
          try {
            await task.run();
          } catch (e) {
            errors.push(
              sanitizeStatsError(
                e instanceof Error ? e.message : `${task.label} failed.`,
              ),
            );
          }
        })(),
      ),
    );
  }

  // Build formula cards for each test that ran
  const formulas: FormulaCard[] = [];
  if (
    eff.correlation &&
    highlights.find((h) => h.name.includes("Correlation"))
  ) {
    const x: number[] = [],
      y: number[] = [];
    for (const row of cleaned.rows) {
      const vx = row[corrColA],
        vy = row[corrColB];
      if (
        typeof vx === "number" &&
        isFinite(vx) &&
        typeof vy === "number" &&
        isFinite(vy)
      ) {
        x.push(vx);
        y.push(vy);
      }
    }
    const n = x.length;
    if (n > 0) {
      const xBar = fmt(x.reduce((a, b) => a + b, 0) / n, 2);
      const yBar = fmt(y.reduce((a, b) => a + b, 0) / n, 2);
      const rVal =
        highlights.find((h) => h.name.includes("Correlation"))?.metric ?? "";
      formulas.push({
        name: corrMethod === "pearson" ? "Pearson r" : "Spearman \u03C1",
        formula:
          "r = \u03A3[(x\u1D62 - x\u0304)(y\u1D62 - \u0233)] / \u221A[\u03A3(x\u1D62 - x\u0304)\u00B2 \u00B7 \u03A3(y\u1D62 - \u0233)\u00B2]",
        substituted: `n = ${n}, x\u0304 = ${xBar}, \u0233 = ${yBar}`,
        result: rVal,
      });
    }
  }
  if (eff.tTest && next.tTests.length > 0) {
    const res = next.tTests[0];
    formulas.push({
      name: `t-test (${res.type})`,
      formula: "t = (x\u0304 - \u03BC\u2080) / (s / \u221An)",
      substituted: `mean diff = ${fmt(res.meanDiff, 3)}, df = ${res.df}, Cohen's d = ${fmt(res.cohensD, 3)}`,
      result: `t = ${statOrDash(res.t, 2)}, p = ${fmt(res.pValue)}`,
    });
  }
  if (eff.anova && next.anova.length > 0) {
    const res = next.anova[0];
    formulas.push({
      name: "One-way ANOVA",
      formula: "F = MS_between / MS_within = (SS_B / df_B) / (SS_W / df_W)",
      substituted: `\u03B7\u00B2 = ${fmt(res.etaSquared)}, df_B = ${res.dfBetween}, df_W = ${res.dfWithin}`,
      result: `F = ${statOrDash(res.F, 2)}, p = ${fmt(res.pValue)}`,
    });
  }
  if (eff.mannWhitney && next.mannWhitney.length > 0) {
    const res = next.mannWhitney[0];
    const g1Vals = cleaned.rows
      .filter((r) => String(r[displayMwGroupCol]) === res.group1)
      .map((r) => r[displayMwCol])
      .filter((v): v is number => typeof v === "number" && isFinite(v));
    const g2Vals = cleaned.rows
      .filter((r) => String(r[displayMwGroupCol]) === res.group2)
      .map((r) => r[displayMwCol])
      .filter((v): v is number => typeof v === "number" && isFinite(v));
    const n1 = g1Vals.length,
      n2 = g2Vals.length;
    formulas.push({
      name: "Mann-Whitney U",
      formula: "U = n\u2081n\u2082 + n\u2081(n\u2081+1)/2 - R\u2081",
      substituted: `n\u2081(${res.group1}) = ${n1}, n\u2082(${res.group2}) = ${n2}, n\u2081n\u2082 = ${n1 * n2}, n\u2081(n\u2081+1)/2 = ${(n1 * (n1 + 1)) / 2}`,
      result: `U = ${statOrDash(res.U, 2)}, p = ${fmt(res.pValue)}`,
    });
  }
  if (eff.kruskal && next.kruskalWallis.length > 0) {
    const res = next.kruskalWallis[0];
    const groups = groupValuesFor(displayKwGroup);
    const N = cleaned.rows.filter(
      (r) =>
        typeof r[displayKwCol] === "number" &&
        isFinite(r[displayKwCol] as number),
    ).length;
    if (N > 0) {
      formulas.push({
        name: "Kruskal-Wallis H",
        formula:
          "H = [12 / N(N+1)] \u00B7 \u03A3(R\u1D62\u00B2 / n\u1D62) - 3(N+1)",
        substituted: `N = ${N}, k = ${groups.length} groups, df = ${res.df}, 12/N(N+1) = ${fmt(12 / (N * (N + 1)), 6)}`,
        result: `H = ${statOrDash(res.H, 2)}, p = ${fmt(res.pValue)}`,
      });
    }
  }
  if (eff.chiSquare && next.chiSquare.length > 0) {
    const res = next.chiSquare[0];
    const nObs = cleaned.rows.filter(
      (r) =>
        r[res.column1] != null &&
        r[res.column1] !== "" &&
        r[res.column2] != null &&
        r[res.column2] !== "",
    ).length;
    const nRows = [
      ...new Set(
        cleaned.rows.map((r) => String(r[res.column1] ?? "")).filter(Boolean),
      ),
    ].length;
    const nCols = [
      ...new Set(
        cleaned.rows.map((r) => String(r[res.column2] ?? "")).filter(Boolean),
      ),
    ].length;
    formulas.push({
      name: "Chi-square (\u03C7\u00B2)",
      formula:
        "\u03C7\u00B2 = \u03A3 [(O\u1D62\u2C7C - E\u1D62\u2C7C)\u00B2 / E\u1D62\u2C7C]",
      substituted: `N = ${nObs}, table = ${nRows}\u00D7${nCols}, df = ${res.df}, Cram\u00E9r's V = ${fmt(res.cramersV)}`,
      result: `\u03C7\u00B2 = ${statOrDash(res.chiSq, 2)}, p = ${fmt(res.pValue)}`,
    });
  }
  if (eff.regression && next.regression.length > 0) {
    const res = next.regression[0];
    const coeffs = Object.entries(res.coefficients)
      .map(([k, v]) => `${k}: \u03B2=${fmt(v, 3)}`)
      .join(", ");
    const colNames = Object.keys(res.coefficients);
    const formulaTerms =
      colNames.length <= 4
        ? colNames
            .map((name, idx) => `\u03B2${idx + 1}\u00B7${name}`)
            .join(" + ")
        : colNames
            .slice(0, 3)
            .map((name, idx) => `\u03B2${idx + 1}\u00B7${name}`)
            .join(" + ") + " + ...";
    formulas.push({
      name: "OLS Regression",
      formula: `\u0177 = \u03B2\u2080 + ${formulaTerms} + \u03B5`,
      substituted: `Intercept = ${fmt(res.intercept, 3)}, ${coeffs}`,
      result: `R\u00B2 = ${fmt(res.rSquared)}, F p = ${fmt(res.fPValue)}`,
    });
  }

  const resultRecommendations = await fetchRecommendations(highlights)
    .then((res) => res.recommendations)
    .catch(() => [] as ResultRecommendation[]);

  return {
    blocked: false,
    error: errors.length > 0 ? errors.join(" | ") : null,
    warnings: Array.from(new Set(allWarnings)),
    highlights,
    formulas,
    next,
    resultRecommendations,
  };
}

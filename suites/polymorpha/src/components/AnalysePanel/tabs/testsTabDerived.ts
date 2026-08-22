/**
 * testsTabDerived — pure derivations for the TestsTab active test configuration.
 */
import { getDisabledReason } from "@polymorpha/business-logic";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";
import type { TestKey } from "@/components/AnalysePanel/analyseHelpers";
import type { TTestType } from "@/types";

type ColumnTypeMap = Record<string, string>;

export interface ActiveTestDerivedInputs {
  activeTestKey: TestKey;
  corrColA: string;
  corrColB: string;
  corrMethod: "pearson" | "spearman";
  displayTCol1: string;
  displayTCol2: string;
  tType: TTestType;
  tMu: number;
  displayAnovaY: string;
  displayAnovaGroup: string;
  displayTwoWayY?: string;
  displayTwoWayGroupA?: string;
  displayTwoWayGroupB?: string;
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
  columnTypeMap: ColumnTypeMap;
  // Extended — generic fallbacks
  genericCols?: string[];
  genericColA?: string;
  genericColB?: string;
  genericControl?: string;
}

export interface ActiveTestDerived {
  summary: string;
  config: Parameters<typeof getDisabledReason>[1];
  autoVizCols: { colA: string; colB?: string } | null;
  disabledReason: string | null;
  canRun: boolean;
}

export function computeActiveTestDerived(
  input: ActiveTestDerivedInputs,
): ActiveTestDerived {
  const summary = (() => {
    switch (input.activeTestKey) {
      case "correlation":
        return `${formatColumnLabel(input.corrColA || "Numeric A")} vs ${formatColumnLabel(input.corrColB || "Numeric B")}`;
      case "tTest":
        return input.tType === "one-sample"
          ? `${formatColumnLabel(input.displayTCol1 || "Numeric column")} against mu=${input.tMu}`
          : `${formatColumnLabel(input.displayTCol1 || "Column 1")} vs ${formatColumnLabel(input.displayTCol2 || "Column 2")}`;
      case "anova":
        return `${formatColumnLabel(input.displayAnovaY || "Numeric response")} by ${formatColumnLabel(input.displayAnovaGroup || "group column")}`;
      case "welchAnova":
        return `${formatColumnLabel(input.displayAnovaY || "Numeric response")} by ${formatColumnLabel(input.displayAnovaGroup || "group column")} (no equal-variance assumption)`;
      case "levene":
        return `Variance equality for ${formatColumnLabel(input.displayAnovaY || "Numeric response")} across ${formatColumnLabel(input.displayAnovaGroup || "groups")}`;
      case "regression":
        return `${formatColumnLabel(input.displayRegY || "Target")} with ${input.displayRegX.length} predictor${input.displayRegX.length === 1 ? "" : "s"}`;
      case "vif":
        return `${input.displayVifCols.length} predictor${input.displayVifCols.length === 1 ? "" : "s"} checked for collinearity`;
      case "mannWhitney":
        return `${formatColumnLabel(input.displayMwCol || "Numeric variable")} by ${formatColumnLabel(input.displayMwGroupCol || "group column")}`;
      case "kruskal":
        return `${formatColumnLabel(input.displayKwCol || "Numeric variable")} by ${formatColumnLabel(input.displayKwGroup || "group column")}`;
      case "chiSquare":
        return `${formatColumnLabel(input.displayChiCol1 || "Categorical A")} vs ${formatColumnLabel(input.displayChiCol2 || "Categorical B")}`;
      case "fisher":
        return `${formatColumnLabel(input.displayFisherCol1 || "Categorical A")} vs ${formatColumnLabel(input.displayFisherCol2 || "Categorical B")} (2x2)`;
      // Extended — inferential summaries (filtered)
      case "friedman":
        return `${input.genericCols?.length ?? 0} columns — ${formatColumnLabel(input.activeTestKey)}`;
      case "mcnemar":
        return `${formatColumnLabel(input.genericColA || "Col A")} vs ${formatColumnLabel(input.genericColB || "Col B")}`;
      case "tost":
        return `${formatColumnLabel(input.genericColA || "Numeric")} TOST`;
      case "binomial":
      case "gofChisquare":
        return `${formatColumnLabel(input.genericColA || "Categorical")}`;
      case "twoWayAnova":
        return `${formatColumnLabel(input.displayTwoWayY ?? input.displayAnovaY ?? "Response")} by ${formatColumnLabel(input.displayTwoWayGroupA ?? input.displayAnovaGroup ?? "A")} & ${formatColumnLabel(input.displayTwoWayGroupB ?? input.genericColB ?? "B")}`;
      case "repeatedAnova":
        return `Repeated: ${formatColumnLabel(input.genericColA || "subject")} / ${formatColumnLabel(input.genericColB || "within")}`;
      case "kendallTau":
        return `${formatColumnLabel(input.genericColA || "A")} vs ${formatColumnLabel(input.genericColB || "B")} (Kendall)`;
      case "partialCorrelation":
        return `${formatColumnLabel(input.genericColA || "X")}–${formatColumnLabel(input.genericColB || "Y")} | ${formatColumnLabel(input.genericControl || "Z")}`;
      case "pointBiserial":
        return `${formatColumnLabel(input.genericColA || "Binary")} vs ${formatColumnLabel(input.genericColB || "Numeric")}`;
      case "logisticRegression":
      case "ridgeRegression":
      case "lassoRegression":
        return `${formatColumnLabel(input.displayRegY || "Target")} ~ ${input.displayRegX.length} preds`;
      case "moderation":
      case "mediation":
        return `${formatColumnLabel(input.displayRegY || "Target")} moderation/mediation`;
      default:
        return formatColumnLabel(input.activeTestKey);
    }
  })();

  const config = (() => {
    switch (input.activeTestKey) {
      case "correlation":
        return {
          colA: input.corrColA,
          colB: input.corrColB,
          method: input.corrMethod,
        };
      case "tTest":
        return {
          col1: input.displayTCol1,
          col2: input.displayTCol2,
          type: input.tType,
          mu: input.tMu,
        };
      case "anova":
      case "welchAnova":
      case "levene":
        return {
          responseCol: input.displayAnovaY,
          groupCol: input.displayAnovaGroup,
        };
      case "regression":
        return {
          responseCol: input.displayRegY,
          predictors: input.displayRegX,
        };
      case "vif":
        return { cols: input.displayVifCols };
      case "mannWhitney":
        return {
          numCol: input.displayMwCol,
          groupCol: input.displayMwGroupCol,
          g1: input.displayMwG1,
          g2: input.displayMwG2,
        };
      case "kruskal":
        return { numCol: input.displayKwCol, groupCol: input.displayKwGroup };
      case "chiSquare":
        return { col1: input.displayChiCol1, col2: input.displayChiCol2 };
      case "fisher":
        return { col1: input.displayFisherCol1, col2: input.displayFisherCol2 };
      case "wilcoxon":
        return { col1: input.displayTCol1, col2: input.displayTCol2 };
      case "friedman":
        return { columns: input.genericCols ?? input.displayVifCols };
      case "mcnemar":
        return {
          col1: input.genericColA ?? input.displayChiCol1,
          col2: input.genericColB ?? input.displayChiCol2,
        };
      case "tost":
        return {
          col: input.genericColA ?? input.displayTCol1,
          low: -0.5,
          high: 0.5,
        };
      case "binomial":
      case "gofChisquare":
        return { col: input.genericColA ?? input.displayChiCol1 };
      case "twoWayAnova":
        return {
          responseCol: input.displayTwoWayY ?? input.displayAnovaY,
          factorA: input.displayTwoWayGroupA ?? input.displayAnovaGroup,
          factorB:
            input.displayTwoWayGroupB ??
            input.genericColB ??
            input.displayChiCol1,
        };
      case "repeatedAnova":
        return {
          subjectCol: input.genericColA ?? input.displayMwGroupCol,
          withinCol: input.genericColB ?? input.displayAnovaGroup,
          valueCol: input.displayAnovaY,
        };
      case "kendallTau":
        return {
          colA: input.genericColA ?? input.corrColA,
          colB: input.genericColB ?? input.corrColB,
        };
      case "partialCorrelation":
        return {
          colA: input.genericColA ?? input.corrColA,
          colB: input.genericColB ?? input.corrColB,
          control: input.genericControl ?? input.displayTCol1,
        };
      case "pointBiserial":
        return {
          catCol: input.genericColA ?? input.displayChiCol1,
          numCol: input.genericColB ?? input.displayTCol1,
        };
      case "logisticRegression":
      case "ridgeRegression":
      case "lassoRegression":
        return { target: input.displayRegY, predictors: input.displayRegX };
      case "moderation":
        return {
          target: input.displayRegY,
          predictor: input.displayRegX[0] ?? input.genericColA ?? "",
          moderator: input.displayRegX[1] ?? input.genericColB ?? "",
        };
      case "mediation":
        return {
          target: input.displayRegY,
          predictor: input.displayRegX[0] ?? "",
          mediator: input.displayRegX[1] ?? "",
        };
      default:
        return {
          columns: input.genericCols ?? [],
        } as unknown as Parameters<typeof getDisabledReason>[1];
    }
  })();

  const autoVizCols: { colA: string; colB?: string } | null = (() => {
    switch (input.activeTestKey) {
      case "correlation":
        return input.corrColA && input.corrColB
          ? { colA: input.corrColA, colB: input.corrColB }
          : null;
      case "tTest":
        return input.displayTCol1 && input.displayTCol2
          ? { colA: input.displayTCol1, colB: input.displayTCol2 }
          : null;
      case "anova":
      case "welchAnova":
      case "levene":
        return input.displayAnovaY && input.displayAnovaGroup
          ? { colA: input.displayAnovaY, colB: input.displayAnovaGroup }
          : null;
      case "regression":
        return input.displayRegY && input.displayRegX[0]
          ? { colA: input.displayRegY, colB: input.displayRegX[0] }
          : null;
      case "mannWhitney":
        return input.displayMwCol && input.displayMwGroupCol
          ? { colA: input.displayMwCol, colB: input.displayMwGroupCol }
          : null;
      case "kruskal":
        return input.displayKwCol && input.displayKwGroup
          ? { colA: input.displayKwCol, colB: input.displayKwGroup }
          : null;
      case "chiSquare":
      case "fisher":
        return null; // categorical-vs-categorical, no chart applicable
      default:
        return null;
    }
  })();

  const disabledReason = getDisabledReason(
    input.activeTestKey,
    config,
    input.columnTypeMap,
  );

  return {
    summary,
    config,
    autoVizCols,
    disabledReason,
    canRun: disabledReason === null,
  };
}

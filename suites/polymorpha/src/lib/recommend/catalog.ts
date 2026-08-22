import {
  TEST_GROUPS,
  TEST_META,
  ADVANCED_TEST_KEYS,
  type TestKey,
} from "@polymorpha/business-logic";
import { CLEAN_TREE } from "@/components/CleaningPanel/constants";
import type { RagDatasetProfile } from "@/lib/rag/types";

// ── Catalog item ───
export type CatalogItem = {
  id: string;
  label: string;
  purpose: string;
  requires?: string; // human-readable prerequisites
  group: string; // e.g. "Parametric", "Relationship", "Data quality"
  groupId: string; // e.g. "difference", "correlation"
  tier: "core" | "advanced";
  stage: "preview" | "process" | "analyse" | "export";
  uiPath: string; // canonical UI navigation, e.g. "Analyse → Correlation"
  ml: boolean;
  requiresCheck?: (rag: RagDatasetProfile) => boolean; // deterministic Applicable check
};

// ── Helpers ──
function isPredictiveObjective(objective: string): boolean {
  // Semantic, not keyword-heavy: explicit prediction/classification/forecasting/model-building intent
  // Do NOT treat "regression" alone as predictive — regression can be explanatory (per user correction)
  const s = objective.toLowerCase();
  return (
    /\bpredict(ion|ing|s)?\b/.test(s) ||
    /\bclassif(y|ication)\b/.test(s) ||
    /\bforecast(ing)?\b/.test(s) ||
    /\bmachine learning\b/.test(s) ||
    /\bmodel building\b/.test(s) ||
    /\btrain(ing)?\s+(a\s+)?model\b/.test(s)
  );
}

function hasNumeric(rag: RagDatasetProfile): boolean {
  return (rag.perColumn ?? []).some((c) => c.type === "numeric");
}
function hasCategorical(rag: RagDatasetProfile): boolean {
  return (rag.perColumn ?? []).some((c) => c.type === "categorical");
}
function countNumeric(rag: RagDatasetProfile): number {
  return (rag.perColumn ?? []).filter((c) => c.type === "numeric").length;
}
function countCategorical(rag: RagDatasetProfile): number {
  return (rag.perColumn ?? []).filter((c) => c.type === "categorical").length;
}
function hasTwoNumeric(rag: RagDatasetProfile): boolean {
  return countNumeric(rag) >= 2;
}
function hasNumericAndCategorical(rag: RagDatasetProfile): boolean {
  return hasNumeric(rag) && hasCategorical(rag);
}

// ── Purpose + requires + uiPath per TestKey (human-readable, not raw id) ──
const ANALYSE_TEST_DETAILS: Record<
  TestKey,
  {
    purpose: string;
    requires: string;
    requiresCheck: (rag: RagDatasetProfile) => boolean;
    uiPath: string;
    ml: boolean;
  }
> = {
  correlation: {
    purpose: "Measure linear association between two numeric variables",
    requires: "2 numeric variables",
    requiresCheck: hasTwoNumeric,
    uiPath: "Analyse → Correlation",
    ml: false,
  },
  tTest: {
    purpose:
      "Compare means between two independent groups (or one-sample/paired variants)",
    requires: "numeric outcome + categorical with 2 groups, or paired numeric",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Parametric → t-test",
    ml: false,
  },
  anova: {
    purpose: "Compare means across multiple groups",
    requires: "numeric outcome + categorical with 3+ groups",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Parametric → ANOVA",
    ml: false,
  },
  welchAnova: {
    purpose:
      "Compare means across multiple groups when equal variance is questionable",
    requires: "numeric outcome + categorical with 3+ groups",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Parametric → Welch's ANOVA",
    ml: false,
  },
  levene: {
    purpose: "Test whether groups have equal variances (assumption check)",
    requires: "numeric outcome + categorical groups",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Parametric → Levene's Test",
    ml: false,
  },
  regression: {
    purpose:
      "Model numeric target as linear function of predictors (explanatory or predictive)",
    requires: "numeric target + 1+ numeric/categorical predictors",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Modelling → OLS Regression",
    ml: false,
  },
  vif: {
    purpose: "Detect multicollinearity among predictors (variance inflation)",
    requires: "2+ numeric predictors",
    requiresCheck: (rag) => countNumeric(rag) >= 2,
    uiPath: "Analyse → Tests → Modelling → VIF",
    ml: false,
  },
  mannWhitney: {
    purpose:
      "Rank-based comparison for two independent groups (non-parametric alternative to t-test)",
    requires: "numeric outcome + categorical with 2 groups",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Non-Parametric → Mann-Whitney U",
    ml: false,
  },
  kruskal: {
    purpose:
      "Rank-based comparison across multiple groups (non-parametric alternative to ANOVA)",
    requires: "numeric outcome + categorical with 3+ groups",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Non-Parametric → Kruskal-Wallis",
    ml: false,
  },
  chiSquare: {
    purpose: "Test association between two categorical variables",
    requires: "2 categorical variables",
    requiresCheck: (rag) => countCategorical(rag) >= 2,
    uiPath: "Analyse → Tests → Non-Parametric → Chi-square",
    ml: false,
  },
  fisher: {
    purpose: "Exact test for 2×2 contingency (small samples)",
    requires: "2 categorical variables, 2×2 table",
    requiresCheck: (rag) => countCategorical(rag) >= 2,
    uiPath: "Analyse → Tests → Non-Parametric → Fisher's Exact",
    ml: false,
  },
  wilcoxon: {
    purpose: "Non-parametric paired test for two related numeric samples",
    requires: "2 related numeric samples (paired)",
    requiresCheck: hasTwoNumeric,
    uiPath: "Analyse → Tests → Non-Parametric → Wilcoxon Signed-Rank",
    ml: false,
  },
  tost: {
    purpose: "Two one-sided tests for equivalence (bounds [low, high])",
    requires: "numeric outcome + equivalence bounds",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Parametric → TOST Equivalence",
    ml: false,
  },
  binomial: {
    purpose: "Exact test for a proportion vs p₀",
    requires: "categorical/binary variable",
    requiresCheck: hasCategorical,
    uiPath: "Analyse → Tests → Non-Parametric → Binomial Test",
    ml: false,
  },
  mcnemar: {
    purpose: "Paired binary proportions (2×2 within-subject)",
    requires: "paired binary variables",
    requiresCheck: hasCategorical,
    uiPath: "Analyse → Tests → Non-Parametric → McNemar",
    ml: false,
  },
  gofChisquare: {
    purpose: "Goodness-of-fit for single categorical vs expected",
    requires: "single categorical variable",
    requiresCheck: hasCategorical,
    uiPath: "Analyse → Tests → Non-Parametric → GOF Chi-square",
    ml: false,
  },
  twoWayAnova: {
    purpose: "Two factors + interaction (balanced via OLS)",
    requires: "numeric outcome + 2 categorical factors",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Tests → Parametric → Two-way ANOVA",
    ml: false,
  },
  repeatedAnova: {
    purpose: "Within-subject ANOVA with Greenhouse-Geisser correction",
    requires: "repeated numeric measures (same subjects)",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Parametric → Repeated Measures ANOVA",
    ml: false,
  },
  friedman: {
    purpose: "Non-parametric repeated measures (≥3 conditions)",
    requires: "repeated numeric measures, 3+ conditions",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Non-Parametric → Friedman",
    ml: false,
  },
  kendallTau: {
    purpose: "Rank correlation for two columns (robust to ties)",
    requires: "2 variables (numeric or ordinal)",
    requiresCheck: (rag) => (rag.perColumn?.length ?? 0) >= 2,
    uiPath: "Analyse → Correlation → Kendall's Tau",
    ml: false,
  },
  partialCorrelation: {
    purpose: "Correlation of x–y controlling for z",
    requires: "3 numeric variables",
    requiresCheck: (rag) => countNumeric(rag) >= 3,
    uiPath: "Analyse → Correlation → Partial Correlation",
    ml: false,
  },
  pointBiserial: {
    purpose: "Binary vs numeric correlation",
    requires: "1 numeric + 1 binary categorical",
    requiresCheck: hasNumericAndCategorical,
    uiPath: "Analyse → Correlation → Point-biserial",
    ml: false,
  },
  logisticRegression: {
    purpose:
      "Model binary target with odds ratios, CI, AUC (explanatory or predictive)",
    requires: "binary categorical target + predictors",
    requiresCheck: hasCategorical,
    uiPath: "Analyse → Tests → Modelling → Logistic Regression",
    ml: false,
  },
  ridgeRegression: {
    purpose: "L2-regularized regression with CV R²",
    requires: "numeric target + predictors (regularized)",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Modelling → Ridge Regression",
    ml: false,
  },
  lassoRegression: {
    purpose: "L1-regularized regression with feature selection, CV R²",
    requires: "numeric target + predictors (regularized)",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Modelling → Lasso Regression",
    ml: false,
  },
  moderation: {
    purpose: "Interaction: target ~ predictor * moderator",
    requires: "numeric target + predictor + moderator",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Modelling → Moderation",
    ml: false,
  },
  mediation: {
    purpose: "Indirect effect via mediator (Baron & Kenny / Sobel)",
    requires: "numeric target + predictor + mediator",
    requiresCheck: hasNumeric,
    uiPath: "Analyse → Tests → Modelling → Mediation",
    ml: false,
  },
};

// ── Stage catalogs ──
function buildPreviewCatalog(): CatalogItem[] {
  return [
    {
      id: "datasetProfile",
      label: "Dataset profile",
      purpose: "Understand dataset size, structure and variable types",
      requires: "dataset loaded",
      group: "Dataset",
      groupId: "dataset",
      tier: "core",
      stage: "preview",
      uiPath: "Preview → Dataset header",
      ml: false,
    },
    {
      id: "columnProfile",
      label: "Column profile",
      purpose:
        "Understand distributions, central tendency, spread and column-level characteristics",
      requires: "columns detected",
      group: "Columns",
      groupId: "columns",
      tier: "core",
      stage: "preview",
      uiPath: "Preview → Column preview",
      ml: false,
    },
    {
      id: "missingPreview",
      label: "Missing preview",
      purpose: "Preview missing counts per column before cleaning",
      requires: "dataset loaded",
      group: "Dataset",
      groupId: "dataset",
      tier: "core",
      stage: "preview",
      uiPath: "Preview → Column preview",
      ml: false,
    },
  ];
}

function buildProcessCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const g of CLEAN_TREE) {
    for (const step of g.items) {
      const isAdvanced =
        step.id === "derived" ||
        step.id === "lag-lead" ||
        step.id === "interaction" ||
        step.id === "encoding";
      items.push({
        id: step.id,
        label: step.label,
        purpose: g.group,
        requires: g.group,
        group: g.group,
        groupId: g.group.toLowerCase().replace(/\s/g, "-"),
        tier: isAdvanced ? "advanced" : "core",
        stage: "process",
        uiPath: `Process → ${g.group} → ${step.label}`,
        ml: false,
      });
    }
  }
  // Add auto descriptive preview available in Process explore
  items.push(
    {
      id: "explore-descriptive",
      label: "Descriptive preview",
      purpose: "Preview descriptive statistics before analysis",
      requires: "numeric columns",
      group: "Explore",
      groupId: "explore",
      tier: "core",
      stage: "process",
      uiPath: "Process → Explore → Descriptive",
      ml: false,
    },
    {
      id: "explore-frequency",
      label: "Frequency preview",
      purpose: "Preview category counts before analysis",
      requires: "categorical columns",
      group: "Explore",
      groupId: "explore",
      tier: "core",
      stage: "process",
      uiPath: "Process → Explore → Frequencies",
      ml: false,
    },
  );
  return items;
}

function buildAnalyseCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [];
  // Auto tabs: Descriptive, Frequency, Correlation matrix, Normality, Visualise
  items.push(
    {
      id: "descriptive",
      label: "Descriptive statistics",
      purpose: "Center, spread, skewness, kurtosis, missingness per column",
      requires: "numeric columns",
      group: "Descriptive",
      groupId: "descriptive",
      tier: "core",
      stage: "analyse",
      uiPath: "Analyse → Descriptive",
      ml: false,
      requiresCheck: hasNumeric,
    },
    {
      id: "frequency",
      label: "Frequency",
      purpose: "Category counts and percentages for categorical columns",
      requires: "categorical columns",
      group: "Descriptive",
      groupId: "descriptive",
      tier: "core",
      stage: "analyse",
      uiPath: "Analyse → Frequency",
      ml: false,
      requiresCheck: hasCategorical,
    },
    {
      id: "correlationMatrix",
      label: "Correlation matrix",
      purpose: "Heatmap of pairwise correlations across numeric columns",
      requires: "2+ numeric variables",
      group: "Correlation",
      groupId: "correlation",
      tier: "core",
      stage: "analyse",
      uiPath: "Analyse → Correlation",
      ml: false,
      requiresCheck: hasTwoNumeric,
    },
    {
      id: "normality",
      label: "Normality checks",
      purpose: "Shapiro/Lilliefors to choose parametric vs rank-based tests",
      requires: "numeric columns",
      group: "Descriptive",
      groupId: "descriptive",
      tier: "core",
      stage: "analyse",
      uiPath: "Analyse → Normality",
      ml: false,
      requiresCheck: hasNumeric,
    },
    {
      id: "visualise",
      label: "Visual exploration",
      purpose:
        "Univariate/bivariate charts (bar, box, scatter) with single/bivariate views",
      requires: "dataset loaded",
      group: "Visualisation",
      groupId: "visualisation",
      tier: "core",
      stage: "analyse",
      uiPath: "Analyse → Visualise",
      ml: false,
    },
  );
  // 27 inferential tests from TEST_GROUPS
  for (const g of TEST_GROUPS) {
    for (const key of g.tests) {
      const detail = ANALYSE_TEST_DETAILS[key];
      const isAdvanced = (ADVANCED_TEST_KEYS as readonly string[]).includes(
        key,
      );
      items.push({
        id: key,
        label: TEST_META[key].label,
        purpose: TEST_META[key].summary ?? detail.purpose,
        requires: detail.requires,
        group: g.label,
        groupId: g.id,
        tier: isAdvanced ? "advanced" : "core",
        stage: "analyse",
        uiPath: detail.uiPath,
        ml: detail.ml,
        requiresCheck: detail.requiresCheck,
      });
    }
  }
  // Machine learning (separate group, ml:true, only showcased when predictive)
  const mlItems: CatalogItem[] = [
    {
      id: "ml-classification",
      label: "Classification",
      purpose:
        "Predict categorical target (kNN, SVM, decision tree, random forest, logistic)",
      requires: "categorical target",
      group: "Machine learning",
      groupId: "machineLearning",
      tier: "advanced",
      stage: "analyse",
      uiPath: "Analyse → Machine learning → Classification",
      ml: true,
    },
    {
      id: "ml-regression",
      label: "ML Regression",
      purpose: "Predict numeric target (linear, tree, forest)",
      requires: "numeric target",
      group: "Machine learning",
      groupId: "machineLearning",
      tier: "advanced",
      stage: "analyse",
      uiPath: "Analyse → Machine learning → Regression",
      ml: true,
    },
  ];
  items.push(...mlItems);
  return items;
}

function buildExportCatalog(): CatalogItem[] {
  return [
    {
      id: "exportPdf",
      label: "Export PDF",
      purpose: "Report with methodology, tables, and embedded charts",
      requires: "analysis completed",
      group: "Export",
      groupId: "export",
      tier: "core",
      stage: "export",
      uiPath: "Export → PDF",
      ml: false,
    },
    {
      id: "exportWord",
      label: "Export Word",
      purpose: "Editable report with tables and charts",
      requires: "analysis completed",
      group: "Export",
      groupId: "export",
      tier: "core",
      stage: "export",
      uiPath: "Export → Word",
      ml: false,
    },
    {
      id: "exportExcel",
      label: "Export Excel",
      purpose: "Workbook with data and results sheets",
      requires: "analysis completed",
      group: "Export",
      groupId: "export",
      tier: "core",
      stage: "export",
      uiPath: "Export → Excel",
      ml: false,
    },
    {
      id: "cart",
      label: "Cart curation",
      purpose: "Curate tests and visuals for export",
      requires: "tests/visuals available",
      group: "Export",
      groupId: "export",
      tier: "core",
      stage: "export",
      uiPath: "Export → Cart",
      ml: false,
    },
  ];
}

// Public API
export function getStageCatalog(
  stage: "preview" | "process" | "analyse" | "export",
  rag: RagDatasetProfile,
  opts: { canAdvanced: boolean; objective: string },
): Array<CatalogItem & { state: "available" | "locked" | "applicable" }> {
  const raw: CatalogItem[] =
    stage === "preview"
      ? buildPreviewCatalog()
      : stage === "process"
        ? buildProcessCatalog()
        : stage === "analyse"
          ? buildAnalyseCatalog()
          : buildExportCatalog();

  const isPredictive = isPredictiveObjective(opts.objective);

  // Filter ML group when not predictive (hide, not just "available but not recommended")
  const filtered = raw.filter((it) => {
    if (it.ml && !isPredictive) return false;
    return true;
  });

  return filtered.map((it) => {
    const isLocked = it.tier === "advanced" && !opts.canAdvanced;
    if (isLocked) return { ...it, state: "locked" as const };
    // Applicable determined deterministically from RAG, not LLM
    if (it.requiresCheck) {
      try {
        if (it.requiresCheck(rag))
          return { ...it, state: "applicable" as const };
      } catch {
        // ignore
      }
      // If check exists and fails, show as available (not applicable) — do not claim applicable
      return { ...it, state: "available" as const };
    }
    // No requiresCheck → available (e.g., dataset profile)
    // For preview/process generic items, treat as applicable if RAG has any data
    if (stage === "preview" || stage === "process" || stage === "export") {
      return { ...it, state: "applicable" as const };
    }
    return { ...it, state: "available" as const };
  });
}

export function formatCatalogForPrompt(
  items: Array<CatalogItem & { state: string }>,
): string {
  // Group by group label for human-readable prompt injection
  const byGroup = new Map<string, typeof items>();
  for (const it of items) {
    const g = it.group;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(it);
  }
  const lines: string[] = [];
  lines.push(
    "AVAILABLE METHODS AT THIS STAGE (authoritative — do not invent beyond this):",
  );
  for (const [group, groupItems] of byGroup) {
    lines.push(`${group}:`);
    for (const it of groupItems) {
      const badge =
        it.state === "locked"
          ? "🔒 Locked"
          : it.state === "applicable"
            ? "✓ Applicable"
            : "Available";
      lines.push(
        `- ${it.label} — ${it.purpose} — requires: ${it.requires} — ${badge} — uiPath: ${it.uiPath}`,
      );
    }
  }
  lines.push(
    "Rule: Select exactly ONE primary next action from above. Use objective + RAG applicable state. Other methods section is informational only, rendered deterministically by app — do not present other methods as recommended unless evidence supports.",
  );
  return lines.join("\n");
}

export { isPredictiveObjective };

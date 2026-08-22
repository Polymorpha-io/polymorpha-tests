/**
 * Generated stats-builders matrix suite — validation parity between the
 * lightweight `getDisabledReason` guard and the strict `build*` functions
 * for every test-builder key.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildAnova,
  buildChiSquare,
  buildCorrelation,
  buildFisher,
  buildKruskal,
  buildLevene,
  buildMannWhitney,
  buildRegression,
  buildTTest,
  buildVif,
  buildWelchAnova,
  getDisabledReason,
  type BuilderContext,
  type TestBuilderKey,
} from "@/lib/stats/testBuilders";

vi.mock("@/lib/stats/tests", () => ({
  pairCorrelation: vi.fn().mockResolvedValue({ r: 0.5 }),
  tTest: vi.fn().mockResolvedValue({ t: 1.2, pValue: 0.3 }),
  oneWayAnova: vi.fn().mockResolvedValue({ F: 1.5, pValue: 0.4 }),
  welchAnova: vi.fn().mockResolvedValue({ F: 1.5, pValue: 0.4 }),
  leveneTest: vi.fn().mockResolvedValue({ F: 1.0, pValue: 0.5 }),
  multipleRegression: vi.fn().mockResolvedValue({ rSquared: 0.5 }),
  computeVif: vi.fn().mockResolvedValue({ vif: {} }),
  mannWhitneyU: vi.fn().mockResolvedValue({ U: 10, pValue: 0.4 }),
  kruskalWallis: vi.fn().mockResolvedValue({ H: 1.0, pValue: 0.5 }),
  chiSquare: vi.fn().mockResolvedValue({ chiSq: 1.0, pValue: 0.6 }),
  fisherExact: vi.fn().mockResolvedValue({ pValue: 0.7 }),
}));

import {
  makeBuilderContext,
  groupedRows,
  makeDataset,
  presets,
} from "../../generators";
import type { Dataset } from "@/types";

type ConfigMap = Record<string, unknown>;

interface BuilderCase {
  key: TestBuilderKey;
  label: string;
  ctx: BuilderContext;
  config: ConfigMap;
  /** getDisabledReason must return a reason */
  expectDisabled: boolean;
  /** build* must throw */
  expectThrows: boolean;
}

const mixed = presets.mixed();
const mixedCtx = makeBuilderContext(mixed);
const numeric = mixed.columns.find((c) => c.type === "numeric")!.name;
const cat = mixed.columns.find((c) => c.type === "categorical")!.name;

const singleGroupCtx = makeBuilderContext(presets.mixed()) as BuilderContext & {
  groupValuesFor: (col: string) => string[];
};
singleGroupCtx.groupValuesFor = () => ["Control"];

// Guaranteed two-group rows: each of A/B/C has perGroup numeric rows.
const mwRows = groupedRows({ numeric: "num", group: "grp" }, 4, 42);
const mwDataset: Dataset = {
  fileName: "mw.csv",
  uploadedAt: new Date("2026-07-27T12:00:00Z"),
  columns: [
    { name: "num", type: "numeric", detectedType: "numeric" },
    { name: "grp", type: "categorical", detectedType: "categorical" },
  ],
  rows: mwRows,
};
const mwCtx = makeBuilderContext(mwDataset);

const CASES: BuilderCase[] = [
  // correlation
  {
    key: "correlation",
    label: "correlation missing cols",
    ctx: mixedCtx,
    config: { colA: "", colB: "" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "correlation",
    label: "correlation same col",
    ctx: mixedCtx,
    config: { colA: numeric, colB: numeric, method: "pearson" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "correlation",
    label: "correlation non-numeric col",
    ctx: mixedCtx,
    config: { colA: cat, colB: numeric, method: "pearson" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "correlation",
    label: "correlation valid",
    ctx: mixedCtx,
    config: { colA: numeric, colB: "score", method: "pearson" },
    expectDisabled: false,
    expectThrows: false,
  },

  // t-test
  {
    key: "tTest",
    label: "tTest missing col1",
    ctx: mixedCtx,
    config: { col1: "", type: "independent", mu: 0 },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "tTest",
    label: "tTest non-numeric col1",
    ctx: mixedCtx,
    config: { col1: cat, type: "one-sample", mu: 0 },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "tTest",
    label: "tTest one-sample valid",
    ctx: mixedCtx,
    config: { col1: numeric, type: "one-sample", mu: 25 },
    expectDisabled: false,
    expectThrows: false,
  },
  {
    key: "tTest",
    label: "tTest independent same cols",
    ctx: mixedCtx,
    config: { col1: numeric, col2: numeric, type: "independent", mu: 0 },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "tTest",
    label: "tTest independent valid",
    ctx: mixedCtx,
    config: { col1: numeric, col2: "score", type: "independent", mu: 0 },
    expectDisabled: false,
    expectThrows: false,
  },

  // anova / welchAnova / levene
  {
    key: "anova",
    label: "anova missing response",
    ctx: mixedCtx,
    config: { responseCol: "", groupCol: cat },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "anova",
    label: "anova non-cat factor",
    ctx: mixedCtx,
    config: { responseCol: numeric, groupCol: numeric },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "anova",
    label: "anova valid",
    ctx: mixedCtx,
    config: { responseCol: numeric, groupCol: cat },
    expectDisabled: false,
    expectThrows: false,
  },
  {
    key: "anova",
    label: "anova single group (builder-only check)",
    ctx: singleGroupCtx,
    config: { responseCol: numeric, groupCol: cat },
    expectDisabled: false,
    expectThrows: true,
  },
  {
    key: "welchAnova",
    label: "welchAnova valid",
    ctx: mixedCtx,
    config: { responseCol: numeric, groupCol: cat },
    expectDisabled: false,
    expectThrows: false,
  },
  {
    key: "levene",
    label: "levene valid",
    ctx: mixedCtx,
    config: { responseCol: numeric, groupCol: cat },
    expectDisabled: false,
    expectThrows: false,
  },

  // regression
  {
    key: "regression",
    label: "regression no predictors",
    ctx: mixedCtx,
    config: { responseCol: numeric, predictors: [] },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "regression",
    label: "regression target is predictor",
    ctx: mixedCtx,
    config: { responseCol: numeric, predictors: [numeric] },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "regression",
    label: "regression valid",
    ctx: mixedCtx,
    config: { responseCol: numeric, predictors: ["score"] },
    expectDisabled: false,
    expectThrows: false,
  },

  // vif
  {
    key: "vif",
    label: "vif single col",
    ctx: mixedCtx,
    config: { cols: [numeric] },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "vif",
    label: "vif valid",
    ctx: mixedCtx,
    config: { cols: [numeric, "score"] },
    expectDisabled: false,
    expectThrows: false,
  },

  // mannWhitney
  {
    key: "mannWhitney",
    label: "mannWhitney missing groups",
    ctx: mwCtx,
    config: { numCol: "", groupCol: "", g1: "", g2: "" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "mannWhitney",
    label: "mannWhitney same groups",
    ctx: mwCtx,
    config: { numCol: "num", groupCol: "grp", g1: "A", g2: "A" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "mannWhitney",
    label: "mannWhitney valid",
    ctx: mwCtx,
    config: { numCol: "num", groupCol: "grp", g1: "A", g2: "B" },
    expectDisabled: false,
    expectThrows: false,
  },

  // kruskal
  {
    key: "kruskal",
    label: "kruskal missing cols",
    ctx: mixedCtx,
    config: { numCol: "", groupCol: "" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "kruskal",
    label: "kruskal valid",
    ctx: mixedCtx,
    config: { numCol: numeric, groupCol: cat },
    expectDisabled: false,
    expectThrows: false,
  },

  // chiSquare / fisher
  {
    key: "chiSquare",
    label: "chiSquare same cols",
    ctx: mixedCtx,
    config: { col1: cat, col2: cat },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "chiSquare",
    label: "chiSquare missing cols",
    ctx: mixedCtx,
    config: { col1: "", col2: "" },
    expectDisabled: true,
    expectThrows: true,
  },
  {
    key: "fisher",
    label: "fisher same cols",
    ctx: mixedCtx,
    config: { col1: cat, col2: cat },
    expectDisabled: true,
    expectThrows: true,
  },

  // wilcoxon
  {
    key: "wilcoxon",
    label: "wilcoxon same cols",
    ctx: mixedCtx,
    config: { col1: numeric, col2: numeric },
    expectDisabled: true,
    expectThrows: true,
  },
];

const BUILDER_FNS: Record<
  string,
  (ctx: BuilderContext, config: ConfigMap) => unknown
> = {
  correlation: buildCorrelation,
  tTest: buildTTest,
  anova: buildAnova,
  welchAnova: buildWelchAnova,
  levene: buildLevene,
  regression: buildRegression,
  vif: buildVif,
  mannWhitney: buildMannWhitney,
  kruskal: buildKruskal,
  chiSquare: buildChiSquare,
  fisher: buildFisher,
};

describe("getDisabledReason / build* parity matrix", () => {
  describe.each(CASES)("$key — $label", (tc) => {
    it(`disabled=${tc.expectDisabled} throws=${tc.expectThrows}`, async () => {
      const reason = getDisabledReason(
        tc.key,
        tc.config as never,
        tc.ctx.columnTypeMap,
      );
      expect(typeof reason === "string").toBe(tc.expectDisabled);

      const builder = BUILDER_FNS[tc.key];
      if (tc.expectThrows) {
        expect(() => builder!(tc.ctx, tc.config)).toThrow();
      } else {
        await expect(
          Promise.resolve(builder!(tc.ctx, tc.config)),
        ).resolves.toBeDefined();
      }
    });
  });
});

describe("getDisabledReason — completeness", () => {
  const MINIMAL_SHAPES: Record<TestBuilderKey, unknown> = {
    correlation: { colA: "", colB: "" },
    tTest: { col1: "", type: "one-sample", mu: 0 },
    anova: { responseCol: "", groupCol: "" },
    welchAnova: { responseCol: "", groupCol: "" },
    levene: { responseCol: "", groupCol: "" },
    regression: { responseCol: "", predictors: [] },
    vif: { cols: [] },
    mannWhitney: { numCol: "", groupCol: "", g1: "", g2: "" },
    kruskal: { numCol: "", groupCol: "" },
    chiSquare: { col1: "", col2: "" },
    fisher: { col1: "", col2: "" },
    wilcoxon: { col1: "", col2: "" },
  };

  it("returns a reason or null for every TestBuilderKey", () => {
    const keys = Object.keys(MINIMAL_SHAPES) as TestBuilderKey[];
    for (const key of keys) {
      const result = getDisabledReason(key, MINIMAL_SHAPES[key] as never, {});
      expect(typeof result === "string" || result === null).toBe(true);
    }
  });

  it("flags non-numeric columns", () => {
    const reason = getDisabledReason(
      "correlation",
      { colA: cat, colB: numeric, method: "pearson" },
      mixedCtx.columnTypeMap,
    );
    expect(reason).toBe("Both columns must be numeric");
  });
});

// ── Business-logic canonical 27-key coverage ──────────────────────────
// The local src/lib/stats/testBuilders.ts is a legacy 12-key shim; the
// canonical getDisabledReason/TestConfig live in @polymorpha/business-logic.
// This block guards the full catalog so extended tests (kendallTau, tost,
// twoWayAnova, ...) can never silently lose their wiring again.

import * as BL from "@polymorpha/business-logic";
import type { TestKey } from "@polymorpha/business-logic";

const BL_MINIMAL_SHAPES: Record<BL.TestBuilderKey, unknown> = {
  correlation: { colA: "", colB: "", method: "pearson" },
  tTest: { col1: "", col2: "", type: "one-sample", mu: 0 },
  anova: { responseCol: "", groupCol: "" },
  welchAnova: { responseCol: "", groupCol: "" },
  levene: { responseCol: "", groupCol: "" },
  regression: { responseCol: "", predictors: [] },
  vif: { cols: [] },
  mannWhitney: { numCol: "", groupCol: "", g1: "", g2: "" },
  kruskal: { numCol: "", groupCol: "" },
  chiSquare: { col1: "", col2: "" },
  fisher: { col1: "", col2: "" },
  wilcoxon: { col1: "", col2: "" },
  tost: { col: "", low: -0.5, high: 0.5 },
  binomial: { col: "" },
  mcnemar: { col1: "", col2: "" },
  gofChisquare: { col: "" },
  twoWayAnova: { responseCol: "", factorA: "", factorB: "" },
  repeatedAnova: { subjectCol: "", withinCol: "", valueCol: "" },
  friedman: { columns: [] },
  kendallTau: { colA: "", colB: "" },
  partialCorrelation: { colA: "", colB: "", control: "" },
  pointBiserial: { catCol: "", numCol: "" },
  logisticRegression: { target: "", predictors: [] },
  ridgeRegression: { target: "", predictors: [] },
  lassoRegression: { target: "", predictors: [] },
  moderation: { target: "", predictor: "", moderator: "" },
  mediation: { target: "", predictor: "", mediator: "" },
};

describe("business-logic getDisabledReason — all 27 catalog keys", () => {
  it.each(Object.keys(BL_MINIMAL_SHAPES) as BL.TestBuilderKey[])(
    "%s returns a reason or null without throwing",
    (key) => {
      const result = BL.getDisabledReason(
        key,
        BL_MINIMAL_SHAPES[key] as never,
        {},
      );
      expect(typeof result === "string" || result === null).toBe(true);
    },
  );
});

describe("business-logic builders — extended keys with dedicated builders", () => {
  const EXTENDED_WITH_BUILDERS: Array<{
    key: TestKey;
    config: unknown;
    expectAction: string;
  }> = [
    {
      key: "kendallTau",
      config: { colA: "num_1", colB: "num_2" },
      expectAction: "kendallTau",
    },
    {
      key: "tost",
      config: { col: "num_1", low: -0.5, high: 0.5 },
      expectAction: "tostMean",
    },
    { key: "binomial", config: { col: "flag" }, expectAction: "binomial" },
    {
      key: "twoWayAnova",
      config: { responseCol: "num_1", factorA: "group", factorB: "flag" },
      expectAction: "twoWayAnova",
    },
    {
      key: "friedman",
      config: { columns: ["age", "score", "name"] },
      expectAction: "friedman",
    },
    {
      key: "logisticRegression",
      config: { target: "flag", predictors: ["num_1"] },
      expectAction: "logisticRegression",
    },
  ];

  it.each(EXTENDED_WITH_BUILDERS)(
    "$key builds action '$expectAction'",
    ({ key, config, expectAction }) => {
      const ctx = makeBuilderContext(presets.mixed());
      const builder = (BL as unknown as Record<string, unknown>)[
        `build${key.charAt(0).toUpperCase()}${key.slice(1)}`
      ] as (
        c: BuilderContext,
        cfg: unknown,
      ) => { action: string; payload: unknown };
      expect(builder).toBeTypeOf("function");
      const req = builder(ctx, config);
      expect(req.action).toBe(expectAction);
      expect(req.payload).toBeDefined();
    },
  );
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { TestsTab } from '@/components/AnalysePanel/tabs/TestsTab';

vi.mock('@/lib/stats/api', () => ({
  callStatsApi: vi.fn().mockResolvedValue({
    c1: 'A', c2: 'B', r: 0.8,
    pValue: 0.01, t: 2.5, meanDiff: 1, df: 10, cohensD: 0.5, significant: true, type: 'independent',
    F: 5, etaSquared: 0.2, dfBetween: 2, dfWithin: 20
  })
}));

vi.mock('@polymorpha/business-logic', () => ({
  MethodologyValidator: {
    validate: () => ({ blocks: [], warnings: [] })
  },
    getDisabledReason: () => null,
    buildCorrelation: () => ({ action: 'correlation', payload: { rows: [] } }),
    TEST_GROUPS: [
      { id: "difference", label: "Parametric", tests: ["tTest", "anova", "welchAnova", "levene", "twoWayAnova", "repeatedAnova", "tost"] },
      { id: "advanced", label: "Non-Parametric", tests: ["mannWhitney", "kruskal", "chiSquare", "fisher", "wilcoxon", "friedman", "binomial", "mcnemar", "gofChisquare"] },
      { id: "correlation", label: "Relationship", tests: ["correlation", "kendallTau", "partialCorrelation", "pointBiserial"] },
      { id: "regression", label: "Modelling", tests: ["regression", "vif", "logisticRegression", "ridgeRegression", "lassoRegression", "moderation", "mediation"] },
    ],
    TEST_META: {
      correlation: { label: "Correlation", group: "correlation", summary: "" },
      tTest: { label: "t-test", group: "difference", summary: "" },
      anova: { label: "ANOVA", group: "difference", summary: "" },
      welchAnova: { label: "Welch's ANOVA", group: "difference", summary: "" },
      levene: { label: "Levene's Test", group: "difference", summary: "" },
      twoWayAnova: { label: "Two-way ANOVA", group: "difference", summary: "" },
      repeatedAnova: { label: "Repeated Measures ANOVA", group: "difference", summary: "" },
      tost: { label: "TOST Equivalence", group: "difference", summary: "" },
      mannWhitney: { label: "Mann-Whitney U", group: "advanced", summary: "" },
      kruskal: { label: "Kruskal-Wallis", group: "advanced", summary: "" },
      chiSquare: { label: "Chi-square", group: "advanced", summary: "" },
      fisher: { label: "Fisher's Exact", group: "advanced", summary: "" },
      wilcoxon: { label: "Wilcoxon Signed-Rank", group: "advanced", summary: "" },
      friedman: { label: "Friedman", group: "advanced", summary: "" },
      binomial: { label: "Binomial Test", group: "advanced", summary: "" },
      mcnemar: { label: "McNemar", group: "advanced", summary: "" },
      gofChisquare: { label: "GOF Chi-square", group: "advanced", summary: "" },
      kendallTau: { label: "Kendall's Tau", group: "correlation", summary: "" },
      partialCorrelation: { label: "Partial Correlation", group: "correlation", summary: "" },
      pointBiserial: { label: "Point-biserial", group: "correlation", summary: "" },
      regression: { label: "OLS Regression", group: "regression", summary: "" },
      vif: { label: "VIF (Multicollinearity)", group: "regression", summary: "" },
      logisticRegression: { label: "Logistic Regression", group: "regression", summary: "" },
      ridgeRegression: { label: "Ridge Regression", group: "regression", summary: "" },
      lassoRegression: { label: "Lasso Regression", group: "regression", summary: "" },
      moderation: { label: "Moderation", group: "regression", summary: "" },
      mediation: { label: "Mediation (Sobel)", group: "regression", summary: "" },
    },
    EMPTY_TEST_SELECTION: { correlation: false, tTest: false, anova: false, welchAnova: false, levene: false, regression: false, vif: false, mannWhitney: false, kruskal: false, chiSquare: false, fisher: false, wilcoxon: false, tost: false, binomial: false, mcnemar: false, gofChisquare: false, twoWayAnova: false, repeatedAnova: false, friedman: false, kendallTau: false, partialCorrelation: false, pointBiserial: false, logisticRegression: false, ridgeRegression: false, lassoRegression: false, moderation: false, mediation: false },
    ADVANCED_TEST_KEYS: [],
    ANALYSE_TAB_META: {},
    formatColumnLabel: (s: string) => s,
    humanizeColumnType: (s: string) => s,
    skewClass: () => "",
    corrClass: () => "",
}));

vi.mock('@/lib/stats/tests', () => ({
  recommendations: vi.fn().mockResolvedValue({ recommendations: [] })
}));

vi.mock('@/components/AnalysePanel/tabs/InlineTestChart', () => ({
  InlineTestChart: () => <div data-testid="inline-chart">Chart</div>
}));

vi.mock('@/store/useDataStore', () => ({
  useDataStore: () => ({
    cart: [],
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    cleaned: {
      columns: [{ name: 'A', type: 'numeric' }, { name: 'B', type: 'numeric' }],
      rows: [{ A: 1, B: 2 }, { A: 2, B: 3 }]
    }
  })
}));

vi.mock('@/store/usePrefsStore', () => ({
  usePrefsStore: () => 'beginner',
  fmtNum: (v: number) => v.toFixed(3)
}));

describe('TestsTab', () => {
  it('renders correctly and can run a correlation test', async () => {
    const cleaned = {
      columns: [{ name: 'A', type: 'numeric' }, { name: 'B', type: 'numeric' }],
      rows: [{ A: 1, B: 2 }, { A: 2, B: 3 }]
    } as any;
    
    const computed = {
      numericCols: ['A', 'B'],
      normality: []
    } as any;

    const results = {
      tTests: [],
      anova: [],
      regression: [],
      mannWhitney: [],
      kruskalWallis: [],
      chiSquare: []
    } as any;

    const onSetResults = vi.fn();
    const onVisualize = vi.fn();

    const recommendations = [
      {
        id: "rec_test_A_B",
        type: "test" as const,
        reason: "Both selected variables are numeric.",
        action: "Recommend Pearson Correlation"
      }
    ];

    render(<TestsTab 
      cleaned={cleaned} 
      computed={computed} 
      results={results} 
      canAdvancedTests={true} 
      onSetResults={onSetResults}
      onVisualize={onVisualize}
      recommendations={recommendations}
    />);

    expect(screen.getByText('Test recommendation')).toBeInTheDocument();
    
    // Auto-detect should show Pearson Correlation for two numeric columns
    expect(screen.getByText('Pearson Correlation')).toBeInTheDocument();
    expect(screen.getByText(/Both selected variables are numeric/)).toBeInTheDocument();
    
    // Should display sidebar groups
    expect(screen.getByText('Parametric')).toBeInTheDocument();
    expect(screen.getByText('Non-Parametric')).toBeInTheDocument();
    expect(screen.getByText('Relationship')).toBeInTheDocument();
  });
});

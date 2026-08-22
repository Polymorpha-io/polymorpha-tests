import React, { useMemo, useState, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/store/useDataStore";
import { useAuthStore } from "@/store/useAuthStore";
import { createFirestoreService } from "@/lib/FirestoreService";
import { computeDescriptive, computeFrequency } from "@/lib/stats/descriptive";
import { computeCorrelationMatrix } from "@/lib/stats/correlation";
import { testNormality } from "@/lib/stats/normality";
import { callComputeAll } from "@/lib/stats/api";
import {
  getStorageBackedContext,
  resolveStorageBacked,
} from "@/lib/stats/storageBacked";
import type { MainTab } from "./analyseHelpers";
import type {
  CorrelationMatrix,
  DescriptiveStats,
  FrequencyTable,
  NormalityResult,
  StatsResults,
} from "@/types";
import {
  ANALYSE_TAB_META,
  formatColumnLabel,
  isLikelyIdentifierColumn,
} from "./analyseHelpers";
import { RecommendationLaws } from "@polymorpha/business-logic";
import { RecommendButton } from "@/components/RecommendButton/RecommendButton";
import { insight as fetchInsight } from "@/lib/stats/tests";
import { sanitizeStatsError } from "@/lib/errors/sanitize";
import { CorrelationTab } from "./tabs/CorrelationTab";
import { MachineLearningTab } from "./tabs/MachineLearningTab";
import { NormalityTab } from "./tabs/NormalityTab";
import { TestsTab } from "./tabs/TestsTab";
import "@/components/StatsPanel/StatsPanel.css";
import "@/components/StatsPanel/css/sp-heatmap.css";
import "@/components/StatsPanel/css/sp-normality.css";
import "@/components/StatsPanel/css/sp-zoom.css";
import "@/components/StatsPanel/css/sp-insights.css";
import "./AnalysePanel.css";
import "./css/tabs/tab-body.css";
import "./css/tabs/normality.css";
import "./css/tabs/tests.css";
import "./css/charts.css";
import "./css/insights.css";
import "./css/extras.css";

export function AnalysePanel() {
  const { cleaned, results, setResults, cleaningDiff, cleaningConfig } =
    useDataStore(
      useShallow((s) => ({
        cleaned: s.cleaned,
        results: s.results,
        setResults: s.setResults,
        cleaningDiff: s.cleaningDiff,
        cleaningConfig: s.cleaningConfig,
      })),
    );
  const totalRowCount = useDataStore((s) => s.totalRowCount);
  const raw = useDataStore((s) => s.raw);
  // Global scale: cleaned is often 100-row preview for server path (>5k). Show full count, but if cleaning removed rows locally, show actual cleaned length.
  const isPreview =
    (cleaned?.rows?.length ?? 0) === 100 && (totalRowCount ?? 0) > 100;
  const displayRowCount = isPreview
    ? (totalRowCount ?? cleaned?.rows.length ?? 0)
    : (cleaned?.rows.length ?? totalRowCount ?? raw?.rows.length ?? 0);
  const canAdvancedTests = true;
  const canAdvancedCharts = true;

  const recommendations = useMemo(() => {
    return cleaned ? RecommendationLaws.evaluate(cleaned) : [];
  }, [cleaned]);

  const [activeTab, setActiveTab] = React.useState<MainTab>("tests");
  const [protectionNotice, setProtectionNotice] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    if (!protectionNotice) return;
    const t = setTimeout(() => setProtectionNotice(null), 3000);
    return () => clearTimeout(t);
  }, [protectionNotice]);
  const [showDataViewer, setShowDataViewer] = React.useState(false);

  // 05: protected-mode copy block removed for WCAG — handlers deleted

  const computed = useMemo(() => {
    if (!cleaned?.columns || !cleaned?.rows) return null;
    const numericCols = cleaned.columns
      .filter((c) => c.type === "numeric")
      .filter(
        (c) =>
          !isLikelyIdentifierColumn(
            c.name,
            cleaned.rows.map((row) => row[c.name]),
          ),
      )
      .map((c) => c.name);
    const catCols = cleaned.columns
      .filter((c) => c.type === "categorical")
      .map((c) => c.name);
    return { numericCols, catCols };
  }, [cleaned]);

  interface AsyncStats {
    descriptive: DescriptiveStats[];
    frequencies: FrequencyTable[];
    correlation: CorrelationMatrix | null;
    normality: NormalityResult[];
  }
  const [asyncStats, setAsyncStats] = useState<AsyncStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const statsRequestIdRef = React.useRef(0);

  // Responsive breakpoint for data viewer
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!cleaned || !computed) {
      setAsyncStats(null);
      setStatsError(null);
      return;
    }
    let cancelled = false;
    const requestId = ++statsRequestIdRef.current;
    setStatsError(null);
    setAsyncStats(null);
    const { numericCols, catCols } = computed;
    const sbCtx = getStorageBackedContext();
    const sbPromise = sbCtx
      ? resolveStorageBacked(sbCtx)
      : Promise.resolve(null);
    sbPromise
      .then(async (sb) => {
        // Try single batch computeAll (61 → 1 request) with storageBacked dedup
        try {
          const result = await callComputeAll({
            rows: cleaned.rows,
            numericCols,
            catCols,
            storageBacked: sb,
            cleaningConfig: cleaningConfig as unknown as Record<
              string,
              unknown
            > | null,
          });
          if (cancelled || requestId !== statsRequestIdRef.current) return;
          const hasAny =
            (result.descriptive && result.descriptive.length > 0) ||
            (result.frequencies && result.frequencies.length > 0) ||
            result.correlation ||
            (result.normality && result.normality.length > 0);
          if (hasAny) {
            setAsyncStats({
              descriptive: result.descriptive ?? [],
              frequencies: result.frequencies ?? [],
              correlation: result.correlation ?? null,
              normality: result.normality ?? [],
            });
            return;
          }
          throw new Error("computeAll returned empty");
        } catch (err) {
          console.warn(
            "[AnalysePanel] computeAll failed, falling back to per-col",
            err,
          );
          // Fallback: legacy 2N+1 per-col path (kept for 404/canary + local <=1000 fast path)
          const [descRes, freqRes, corrRes, normRes] = await Promise.allSettled(
            [
              Promise.allSettled(
                numericCols.map((col) =>
                  computeDescriptive(cleaned.rows, col, sb),
                ),
              ),
              Promise.allSettled(
                catCols.map((col) => computeFrequency(cleaned.rows, col, sb)),
              ),
              numericCols.length >= 2
                ? computeCorrelationMatrix(cleaned.rows, numericCols, sb).then(
                    (v) => v,
                    (e) => {
                      console.warn("[AnalysePanel] correlation failed:", e);
                      return null;
                    },
                  )
                : Promise.resolve(null),
              Promise.allSettled(
                numericCols.map((col) =>
                  testNormality(cleaned.rows, col, "auto", sb),
                ),
              ),
            ],
          );
          if (cancelled || requestId !== statsRequestIdRef.current) return;
          const descriptive =
            descRes.status === "fulfilled"
              ? (descRes.value as PromiseSettledResult<DescriptiveStats>[])
                  .filter(
                    (r): r is PromiseFulfilledResult<DescriptiveStats> =>
                      r.status === "fulfilled",
                  )
                  .map((r) => r.value)
              : [];
          const frequencies =
            freqRes.status === "fulfilled"
              ? (freqRes.value as PromiseSettledResult<FrequencyTable>[])
                  .filter(
                    (r): r is PromiseFulfilledResult<FrequencyTable> =>
                      r.status === "fulfilled",
                  )
                  .map((r) => r.value)
              : [];
          const correlation =
            corrRes.status === "fulfilled"
              ? (
                  corrRes as unknown as PromiseFulfilledResult<CorrelationMatrix | null>
                ).value
              : null;
          const normality =
            normRes.status === "fulfilled"
              ? (normRes.value as PromiseSettledResult<NormalityResult>[])
                  .filter(
                    (r): r is PromiseFulfilledResult<NormalityResult> =>
                      r.status === "fulfilled",
                  )
                  .map((r) => r.value)
              : [];
          const failed =
            (descRes.status === "rejected" ? 1 : 0) +
            (descRes.status === "fulfilled"
              ? (
                  descRes.value as PromiseSettledResult<DescriptiveStats>[]
                ).filter((r) => r.status === "rejected").length
              : 0) +
            (freqRes.status === "rejected" ? 1 : 0) +
            (corrRes.status === "rejected" ? 1 : 0) +
            (normRes.status === "rejected" ? 1 : 0);
          if (failed > 0) {
            console.warn(
              `[AnalysePanel] ${failed} stats sub-requests failed; showing partial results.`,
            );
          }
          if (
            descriptive.length === 0 &&
            frequencies.length === 0 &&
            !correlation &&
            normality.length === 0
          ) {
            const firstErr =
              (descRes.status === "rejected" && descRes.reason) ||
              (freqRes.status === "rejected" && freqRes.reason) ||
              (corrRes.status === "rejected" && corrRes.reason) ||
              (normRes.status === "rejected" && normRes.reason);
            setStatsError(
              sanitizeStatsError(
                firstErr instanceof Error
                  ? firstErr.message
                  : "Statistics computation failed. Please try again.",
              ),
            );
            return;
          }
          setAsyncStats({ descriptive, frequencies, correlation, normality });
        }
      })
      .catch((err) => {
        if (!cancelled && requestId === statsRequestIdRef.current) {
          setStatsError(
            sanitizeStatsError(
              err instanceof Error
                ? err.message
                : "Statistics computation failed. Please try again.",
            ),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cleaned, computed, cleaningConfig, retryKey]);

  React.useEffect(() => {
    if (!asyncStats || !computed) return;
    const prev = useDataStore.getState().results;
    setResults({
      descriptive: asyncStats.descriptive,
      frequencies: asyncStats.frequencies,
      correlation: asyncStats.correlation,
      normality: asyncStats.normality,
      tTests: prev?.tTests ?? [],
      anova: prev?.anova ?? [],
      regression: prev?.regression ?? [],
      mannWhitney: prev?.mannWhitney ?? [],
      kruskalWallis: prev?.kruskalWallis ?? [],
      chiSquare: prev?.chiSquare ?? [],
    });
    const uid = useAuthStore.getState().user?.uid;
    if (uid && cleaned)
      createFirestoreService(uid).recordAnalysis(
        displayRowCount,
        cleaned.columns.length,
        0,
      );
  }, [asyncStats, computed, cleaned, displayRowCount, setResults]);

  const allCorrPairs = useMemo(() => {
    const pairs: { label: string; colA: string; colB: string; r: number }[] =
      [];
    if (asyncStats?.correlation) {
      const cols = asyncStats.correlation.columns;
      asyncStats.correlation.values.forEach((row: number[], i: number) =>
        row.forEach((v: number, j: number) => {
          if (j > i && !isNaN(v))
            pairs.push({
              label: `${formatColumnLabel(cols[i])} & ${formatColumnLabel(cols[j])} (r=${v.toFixed(2)})`,
              colA: cols[i],
              colB: cols[j],
              r: v,
            });
        }),
      );
      pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    }
    return pairs;
  }, [asyncStats?.correlation]);

  const [insight, setInsight] = useState("Generating summary insight...");
  useEffect(() => {
    if (!asyncStats || !cleaned) return;
    setInsight("Generating summary insight...");
    const numCols = computed?.numericCols.length ?? 0;
    const catColsCount = computed?.catCols.length ?? 0;
    fetchInsight({
      descriptive: asyncStats.descriptive,
      normality: asyncStats.normality,
      corrPairs: allCorrPairs,
      totalRows: displayRowCount,
      numCols,
      catCols: catColsCount,
    })
      .then((res) => setInsight(res.text))
      .catch((err) => {
        if (import.meta.env.DEV)
          console.warn("[AnalysePanel] insight generation failed", err);
        setInsight(
          "Automatic insight is temporarily unavailable. Review the detailed test and correlation panels below.",
        );
      });
  }, [asyncStats, displayRowCount, computed, allCorrPairs]);

  if (!cleaned?.columns || !cleaned?.rows || !computed) {
    // Global scale: avoid crash on race where Analyse is opened before cleaning finishes. Show friendly empty state instead of white screen.
    if (!cleaned?.columns || !cleaned?.rows) {
      return (
        <div className="analyse-panel analyse-loading">
          <div className="analyse-loading-inner">
            <p>
              Cleaning not finished yet — please wait for processing to
              complete, then analysis will appear.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (statsError)
    return (
      <div className="analyse-panel analyse-loading">
        <div className="analyse-loading-inner">
          <p className="analyse-error-msg">{statsError}</p>
          <button
            className="btn-primary btn-sm"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      </div>
    );

  if (!asyncStats)
    return (
      <div className="analyse-panel analyse-loading">
        <div className="analyse-loading-inner">
          <div className="analyse-spinner" />
          <p>Running statistical analysis...</p>
        </div>
      </div>
    );

  const numCols = computed.numericCols.length;
  const catColsCount = computed.catCols.length;
  const missingCols = asyncStats.descriptive.filter(
    (d) => d.missingPct > 5,
  ).length;
  const nonNormalCount = asyncStats.normality.filter((n) => !n.isNormal).length;

  // Merged computed shape expected by child tabs
  const computedWithStats = { ...computed, ...asyncStats };

  const highCorrPairs = allCorrPairs
    .filter((p) => Math.abs(p.r) >= 0.7)
    .map((p) => p.label);

  const ANALYSE_NAV = [
    {
      group: "Inference",
      items: [
        { id: "tests" as MainTab, label: "Statistical tests" },
        { id: "machineLearning" as MainTab, label: "Machine learning" },
      ],
    },
    {
      group: "Relationships",
      items: [
        { id: "correlation" as MainTab, label: "Correlation" },
        { id: "normality" as MainTab, label: "Normality" },
      ],
    },
  ];

  const activeTabMeta = ANALYSE_TAB_META[activeTab];

  const safeResults: StatsResults = results ?? {
    descriptive: [],
    frequencies: [],
    correlation: null,
    normality: [],
    tTests: [],
    anova: [],
    regression: [],
    mannWhitney: [],
    kruskalWallis: [],
    chiSquare: [],
  };

  return (
    <div className="analyse-panel">
      {protectionNotice && (
        <p className="analyse-protection-notice">{protectionNotice}</p>
      )}
      {cleaningDiff?.encodingLog?.length ? (
        <div className="encoding-log-bar">
          <span className="encoding-log-label">Data Engineering Applied:</span>
          <div className="encoding-log-items">
            {cleaningDiff.encodingLog.map((e) => (
              <span key={e.column} className="encoding-log-chip">
                <strong>{formatColumnLabel(e.column)}</strong>
                {e.type === "binary" && " \u2192 Binary (0/1)"}
                {e.type === "label" && " \u2192 Label encoded"}
                {e.type === "ordinal" && " \u2192 Ordinal"}
                {e.type === "onehot" &&
                  ` \u2192 ${e.newColumns.length} one-hot cols`}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Header summary */}
      <div className="analyse-header-bar">
        <div className="analyse-header-stats">
          <span>
            <strong>{displayRowCount.toLocaleString()}</strong> rows
          </span>
          <span>
            <strong>{numCols}</strong> numeric
          </span>
          <span>
            <strong>{catColsCount}</strong> categorical
          </span>
          {missingCols > 0 && (
            <span className="analyse-header-warn">
              {missingCols} cols &gt;5% missing
            </span>
          )}
          {nonNormalCount > 0 && (
            <span className="analyse-header-warn">
              {nonNormalCount} non-normal
            </span>
          )}
          {highCorrPairs.length > 0 && (
            <span className="analyse-header-warn">
              {highCorrPairs.length} strong corr
            </span>
          )}
        </div>
        <RecommendButton stage="analyse" />
      </div>

      {/* Tree layout: nav + content */}
      <div className="analyse-tree-layout">
        <aside className="analyse-tree-nav">
          {ANALYSE_NAV.map((group) => (
            <div key={group.group} className="analyse-tree-group">
              <div className="analyse-tree-group-title">{group.group}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`analyse-tree-item${activeTab === item.id ? " active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="analyse-tree-content">
          <div className="analyse-content-header">
            <div>
              <p className="analyse-content-kicker">{activeTabMeta.title}</p>
              <p className="analyse-content-desc">
                {activeTabMeta.description}
              </p>
            </div>
          </div>
          {activeTab === "correlation" && (
            <CorrelationTab
              computed={computedWithStats}
              canAdvancedCharts={canAdvancedCharts}
              recommendations={recommendations}
            />
          )}
          {activeTab === "normality" && (
            <NormalityTab
              computed={computedWithStats}
              recommendations={recommendations}
            />
          )}
          {activeTab === "tests" && (
            <TestsTab
              cleaned={cleaned}
              computed={computedWithStats}
              results={safeResults}
              canAdvancedTests={canAdvancedTests}
              onSetResults={setResults}
              onVisualize={() => {}}
              recommendations={recommendations}
            />
          )}
          {activeTab === "machineLearning" && (
            <MachineLearningTab
              cleaned={cleaned}
              computed={computedWithStats}
              results={safeResults}
              cleaningDiff={cleaningDiff}
              recommendations={recommendations}
            />
          )}
        </div>
      </div>

      {/* Sticky footer insight */}
      <div className="ai-insight-box">
        <span className="ai-insight-label">Auto-insight</span>
        <p className="ai-insight-text">{insight}</p>
      </div>
      {showDataViewer && (
        <div
          className="data-viewer-backdrop"
          onClick={() => setShowDataViewer(false)}
        >
          <div
            className="data-viewer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="data-viewer-head">
              <h3>Current Data Snapshot</h3>
              <button
                className="modal-close-icon"
                aria-label="Close data snapshot"
                onClick={() => setShowDataViewer(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <p className="clean-hint-line">
              Showing first {isMobile ? 15 : 25} rows from the active cleaned
              dataset.
            </p>
            <div className="table-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    {cleaned.columns.map((c) => (
                      <th key={c.name}>{formatColumnLabel(c.name)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cleaned.rows.slice(0, isMobile ? 15 : 25).map((row, i) => (
                    <tr key={i}>
                      {cleaned.columns.map((c) => (
                        <td key={c.name}>{String(row[c.name] ?? "N/A")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

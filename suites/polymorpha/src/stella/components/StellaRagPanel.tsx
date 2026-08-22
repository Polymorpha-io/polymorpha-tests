import { useMemo } from "react";
import { useDataStore } from "@/store/useDataStore";
import { useRecommendations } from "@/lib/stats/recommendations";
import type { Recommendation } from "@polymorpha/business-logic";
import { useRagStore } from "@/store/useRagStore";
import { useShallow } from "zustand/react/shallow";
import "./StellaRagPanel.css";

// ─── Types ───────────────────────────────────────────────────────────────

interface RagPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  numeric: "NUM",
  categorical: "CAT",
  date: "DATE",
  boolean: "BOOL",
  unknown: "?",
};

function formatCount(n: number): string {
  return n.toLocaleString();
}

// ─── Toggle Button ───────────────────────────────────────────────────────

export function StellaRagToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="stella-rag-toggle"
      onClick={onClick}
      title="Dataset diagnostics"
    >
      <span className="stella-rag-toggle-label">RAG</span>
    </button>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────

export function StellaRagPanel({ isOpen, onClose }: RagPanelProps) {
  const raw = useDataStore((s) => s.raw);
  const cleaned = useDataStore((s) => s.cleaned);

  const dataset = cleaned ?? raw;

  const { recommendations, state, loading, offline } =
    useRecommendations(dataset);

  // RAG-only streaming profile (behind on load, pandas, not RecommendationLaws) — G23 multi-dataset
  const ragProfile = useRagStore(
    useShallow((s) => {
      const active = s.activeUploadId
        ? s.byDataset.get(s.activeUploadId)
        : null;
      return active?.profile ?? s.profile;
    }),
  );
  const ragStatus = useRagStore((s) => {
    const active = s.activeUploadId ? s.byDataset.get(s.activeUploadId) : null;
    return active?.status ?? s.status;
  });
  const ragIsProfiling = useRagStore((s) => {
    const active = s.activeUploadId ? s.byDataset.get(s.activeUploadId) : null;
    return active ? active.isProfiling : s.isProfiling;
  });
  const ragByDatasetSize = useRagStore((s) => s.byDataset.size);

  // Group by type
  const cleaning = useMemo(
    () => recommendations.filter((r) => r.type === "cleaning"),
    [recommendations],
  );
  const tests = useMemo(
    () => recommendations.filter((r) => r.type === "test"),
    [recommendations],
  );
  const ml = useMemo(
    () => recommendations.filter((r) => r.type === "ml"),
    [recommendations],
  );

  // ── Empty / no-dataset state ──────────────────────────────────────────

  if (!dataset) {
    return (
      <>
        <div
          className={`stella-rag-overlay${isOpen ? " stella-rag-overlay--visible" : ""}`}
          onClick={onClose}
        />
        <aside
          className={`stella-rag-panel${isOpen ? " stella-rag-panel--open" : ""}`}
          role="dialog"
          aria-modal={isOpen}
          aria-label="Dataset diagnostics"
        >
          <div className="stella-rag-header">
            <div className="stella-rag-header-left">
              <span className="stella-rag-header-icon">◈</span>
              <h2 className="stella-rag-header-title">Dataset RAG</h2>
            </div>
            <button
              className="stella-rag-header-close"
              onClick={onClose}
              aria-label="Close diagnostics"
            >
              ✕
            </button>
          </div>
          <div className="stella-rag-body">
            <div className="stella-rag-empty">
              <p>No dataset loaded.</p>
              <p className="stella-rag-empty-hint">
                Upload a CSV or Excel file to see diagnostics.
              </p>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`stella-rag-overlay${isOpen ? " stella-rag-overlay--visible" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`stella-rag-panel${isOpen ? " stella-rag-panel--open" : ""}`}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Dataset diagnostics"
      >
        {/* Header */}
        <div className="stella-rag-header">
          <div className="stella-rag-header-left">
            <span className="stella-rag-header-icon">◈</span>
            <h2 className="stella-rag-header-title">Dataset RAG</h2>
          </div>
          <button
            className="stella-rag-header-close"
            onClick={onClose}
            aria-label="Close diagnostics"
          >
            ✕
          </button>
        </div>

        <div className="stella-rag-body">
          {/* Dataset Summary */}
          <section className="stella-rag-section">
            <h3 className="stella-rag-section-title">Dataset Summary</h3>
            <div className="stella-rag-meta-grid">
              <div className="stella-rag-meta-item">
                <span className="stella-rag-meta-label">Rows</span>
                <span className="stella-rag-meta-value">
                  {formatCount(dataset.rows.length)}
                </span>
              </div>
              <div className="stella-rag-meta-item">
                <span className="stella-rag-meta-label">Columns</span>
                <span className="stella-rag-meta-value">
                  {dataset.columns.length}
                </span>
              </div>
            </div>
            <p className="stella-rag-filename">{dataset.fileName}</p>

            <h4 className="stella-rag-subtitle">Column Types</h4>
            <div className="stella-rag-columns">
              {dataset.columns.map((col) => (
                <div key={col.name} className="stella-rag-column-item">
                  <span className="stella-rag-col-name">{col.name}</span>
                  <span
                    className={`stella-rag-col-type stella-rag-col-type--${col.type}`}
                  >
                    {TYPE_BADGE[col.type] ?? col.type}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Column Profile (from Python state — pandas-like info) */}
          <section className="stella-rag-section">
            <h3 className="stella-rag-section-title">
              Column Profile
              {loading && <span className="stella-rag-loading-dot">·</span>}
              {offline && (
                <span className="stella-rag-badge stella-rag-badge--offline">
                  offline
                </span>
              )}
            </h3>

            {/* TypeScript: cast state.columns before JSX to avoid unknown→ReactNode error */}
            {(() => {
              const cols = state.columns as
                Record<string, Record<string, unknown>> | undefined;
              const entries = cols
                ? (Object.entries(cols) as [string, Record<string, unknown>][])
                : [];
              if (loading || entries.length === 0) {
                if (loading && recommendations.length === 0) {
                  return (
                    <div className="stella-rag-empty">
                      <p>Computing diagnostics…</p>
                    </div>
                  );
                }
                if (!loading && recommendations.length === 0) {
                  return (
                    <div className="stella-rag-empty">
                      <p>No dataset loaded.</p>
                    </div>
                  );
                }
                return null;
              }
              return (
                <div className="stella-rag-column-profile">
                  {entries.map(([colName, colState]) => (
                    <div key={colName} className="stella-rag-col-card">
                      <div className="stella-rag-col-card-header">
                        <span className="stella-rag-col-name">{colName}</span>
                        <span
                          className={`stella-rag-col-type stella-rag-col-type--${String(colState.type ?? "")}`}
                        >
                          {TYPE_BADGE[colState.type as string] ?? colState.type}
                        </span>
                      </div>
                      <div className="stella-rag-col-stats">
                        {colState.missingPercentage !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Missing
                            </span>
                            <span className="stella-rag-col-stat-value">
                              {colState.missingPercentage as number}%
                            </span>
                          </div>
                        )}
                        <div className="stella-rag-col-stat">
                          <span className="stella-rag-col-stat-label">
                            Unique
                          </span>
                          <span className="stella-rag-col-stat-value">
                            {formatCount(colState.uniqueValues as number)}
                          </span>
                        </div>
                        {colState.skewness !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Skew
                            </span>
                            <span
                              className={`stella-rag-col-stat-value${Math.abs(colState.skewness as number) > 1 ? " stella-rag-col-stat--warn" : ""}`}
                            >
                              {(colState.skewness as number).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {colState.outlierPercentage !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Outliers
                            </span>
                            <span
                              className={`stella-rag-col-stat-value${(colState.outlierPercentage as number) > 5 ? " stella-rag-col-stat--warn" : ""}`}
                            >
                              {(colState.outlierPercentage as number).toFixed(
                                1,
                              )}
                              %
                            </span>
                          </div>
                        )}
                      </div>
                      {colState.isHighlyImbalanced === true && (
                        <div className="stella-rag-col-warning">
                          ⚠ Highly imbalanced
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>

          {/* RAG Streaming Profile — pandas 5 pipelines, behind on load, RAG-only */}
          <section className="stella-rag-section">
            <h3 className="stella-rag-section-title">
              RAG Profile
              {ragIsProfiling && (
                <span className="stella-rag-loading-dot">· streaming</span>
              )}
              {!ragIsProfiling && ragProfile.dataset && (
                <span className="stella-rag-badge stella-rag-badge--offline">
                  ready
                </span>
              )}
              {ragByDatasetSize > 1 && (
                <span className="stella-rag-badge">
                  {ragByDatasetSize} datasets
                </span>
              )}
            </h3>
            {ragStatus && (
              <div className="stella-rag-meta-grid" style={{ marginBottom: 8 }}>
                {(Object.entries(ragStatus) as Array<[string, string]>).map(
                  ([k, v]) => (
                    <div key={k} className="stella-rag-meta-item">
                      <span className="stella-rag-meta-label">{k}</span>
                      <span
                        className={`stella-rag-meta-value ${v === "done" ? "" : v === "running" ? "stella-rag-col-stat--warn" : ""}`}
                      >
                        {v}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
            {ragProfile.dataset && (
              <div className="stella-rag-column-profile">
                <div className="stella-rag-col-card">
                  <div className="stella-rag-col-card-header">
                    <span className="stella-rag-col-name">Dataset</span>
                    <span className="stella-rag-col-type">
                      {ragProfile.dataset.format}
                    </span>
                  </div>
                  <div className="stella-rag-col-stats">
                    <div className="stella-rag-col-stat">
                      <span className="stella-rag-col-stat-label">
                        Duplicate
                      </span>
                      <span className="stella-rag-col-stat-value">
                        {ragProfile.dataset.duplicatePct}%
                      </span>
                    </div>
                    <div className="stella-rag-col-stat">
                      <span className="stella-rag-col-stat-label">
                        Empty rows
                      </span>
                      <span className="stella-rag-col-stat-value">
                        {ragProfile.dataset.emptyRows}
                      </span>
                    </div>
                    <div className="stella-rag-col-stat">
                      <span className="stella-rag-col-stat-label">
                        Constant cols
                      </span>
                      <span className="stella-rag-col-stat-value">
                        {ragProfile.dataset.constantCols.length
                          ? ragProfile.dataset.constantCols.join(", ")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {ragProfile.missing &&
              ragProfile.missing.highMissingCols.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <h4 className="stella-rag-subtitle">Missing &gt;20% cols</h4>
                  <p className="stella-rag-rec-reason">
                    {ragProfile.missing.highMissingCols.join(", ")}
                  </p>
                  {ragProfile.missing.missingTogether.length > 0 && (
                    <p className="stella-rag-rec-action">
                      Together:{" "}
                      {ragProfile.missing.missingTogether
                        .map((m) => `${m.a}↔${m.b} ${m.correlation}`)
                        .join("; ")}
                    </p>
                  )}
                </div>
              )}
            {ragProfile.duplicate &&
              (ragProfile.duplicate.candidateKeys.length > 0 ||
                ragProfile.duplicate.uniqueCols.length > 0) && (
                <div style={{ marginTop: 8 }}>
                  <h4 className="stella-rag-subtitle">Keys</h4>
                  {ragProfile.duplicate.candidateKeys.length > 0 && (
                    <p className="stella-rag-rec-reason">
                      PK candidates:{" "}
                      {ragProfile.duplicate.candidateKeys.join(", ")}
                    </p>
                  )}
                  {ragProfile.duplicate.uniqueCols.length > 0 && (
                    <p className="stella-rag-rec-action">
                      Unique &gt;98%:{" "}
                      {ragProfile.duplicate.uniqueCols.slice(0, 3).join(", ")}
                    </p>
                  )}
                </div>
              )}
            {ragProfile.quality &&
              (ragProfile.quality.whitespaceCols.length > 0 ||
                ragProfile.quality.mixedTypes.length > 0) && (
                <div style={{ marginTop: 8 }}>
                  <h4 className="stella-rag-subtitle">Quality</h4>
                  {ragProfile.quality.whitespaceCols.length > 0 && (
                    <p className="stella-rag-rec-reason">
                      Whitespace: {ragProfile.quality.whitespaceCols.join(", ")}
                    </p>
                  )}
                  {ragProfile.quality.mixedTypes.length > 0 && (
                    <p className="stella-rag-rec-action">
                      Mixed types: {ragProfile.quality.mixedTypes.join(", ")}
                    </p>
                  )}
                  {ragProfile.quality.invalid.length > 0 && (
                    <p className="stella-rag-rec-action">
                      Invalid:{" "}
                      {ragProfile.quality.invalid
                        .map((i) => `${i.column} ${i.issue}×${i.count}`)
                        .join("; ")}
                    </p>
                  )}
                </div>
              )}
            {ragProfile.perColumn && ragProfile.perColumn.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 className="stella-rag-subtitle">Per-column (pandas)</h4>
                <div className="stella-rag-column-profile">
                  {ragProfile.perColumn.slice(0, 6).map((c) => (
                    <div key={c.name} className="stella-rag-col-card">
                      <div className="stella-rag-col-card-header">
                        <span className="stella-rag-col-name">{c.name}</span>
                        <span className="stella-rag-col-type">{c.type}</span>
                      </div>
                      <div className="stella-rag-col-stats">
                        <div className="stella-rag-col-stat">
                          <span className="stella-rag-col-stat-label">
                            Missing
                          </span>
                          <span className="stella-rag-col-stat-value">
                            {c.missingPct}%
                          </span>
                        </div>
                        <div className="stella-rag-col-stat">
                          <span className="stella-rag-col-stat-label">
                            Unique
                          </span>
                          <span className="stella-rag-col-stat-value">
                            {c.unique} ({(c.cardinalityRatio * 100).toFixed(1)}
                            %)
                          </span>
                        </div>
                        {c.mean !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Mean
                            </span>
                            <span className="stella-rag-col-stat-value">
                              {Number(c.mean).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {c.median !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Median
                            </span>
                            <span className="stella-rag-col-stat-value">
                              {Number(c.median).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {c.skewness !== undefined && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Skew
                            </span>
                            <span
                              className={`stella-rag-col-stat-value${Math.abs(Number(c.skewness)) > 1 ? " stella-rag-col-stat--warn" : ""}`}
                            >
                              {Number(c.skewness).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {c.topK && c.topK.length > 0 && (
                          <div className="stella-rag-col-stat">
                            <span className="stella-rag-col-stat-label">
                              Top
                            </span>
                            <span className="stella-rag-col-stat-value">
                              {c.topK[0].value} {c.topK[0].pct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {ragProfile.perColumn.length > 6 && (
                  <p className="stella-rag-rec-action">
                    +{ragProfile.perColumn.length - 6} more columns
                  </p>
                )}
              </div>
            )}
            {!ragProfile.dataset && !ragIsProfiling && (
              <p className="stella-rag-rec-reason">
                Upload a dataset — RAG profiling runs behind via pandas.
              </p>
            )}
          </section>

          {/* Cleaning Recommendations */}
          {cleaning.length > 0 && (
            <section className="stella-rag-section">
              <h3 className="stella-rag-section-title">
                Cleaning
                <span className="stella-rag-badge">{cleaning.length}</span>
              </h3>
              <div className="stella-rag-rec-list">
                {cleaning.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </section>
          )}

          {/* Test Recommendations */}
          {tests.length > 0 && (
            <section className="stella-rag-section">
              <h3 className="stella-rag-section-title">
                Recommended Tests
                <span className="stella-rag-badge">{tests.length}</span>
              </h3>
              <div className="stella-rag-rec-list">
                {tests.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </section>
          )}

          {/* ML Recommendations */}
          {ml.length > 0 && (
            <section className="stella-rag-section">
              <h3 className="stella-rag-section-title">
                ML Guidance
                <span className="stella-rag-badge">{ml.length}</span>
              </h3>
              <div className="stella-rag-rec-list">
                {ml.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} />
                ))}
              </div>
            </section>
          )}

          {recommendations.length === 0 && (
            <div className="stella-rag-empty">
              <p>No issues detected with this dataset.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const typeLabel =
    rec.type === "cleaning" ? "Clean" : rec.type === "test" ? "Test" : "ML";

  return (
    <div className="stella-rag-rec">
      <div className="stella-rag-rec-header">
        <span
          className={`stella-rag-rec-type stella-rag-rec-type--${rec.type}`}
        >
          {typeLabel}
        </span>
      </div>
      <p className="stella-rag-rec-reason">{rec.reason}</p>
      <p className="stella-rag-rec-action">{rec.action}</p>
    </div>
  );
}

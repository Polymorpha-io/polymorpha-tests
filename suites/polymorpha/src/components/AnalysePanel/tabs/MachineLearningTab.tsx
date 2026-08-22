import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import "./MachineLearning.css";
import type { CleaningDiff, Dataset, StatsResults } from "@/types";
import type { ComputedStats } from "@/components/AnalysePanel/analyseHelpers";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";
import type { Recommendation } from "@polymorpha/business-logic";
import type { TaskType } from "./ml-constants";
import { ALGORITHMS } from "./ml-constants";
import { trainModel } from "./mlApi";
import type { TrainResult } from "./mlApi";
import { MlResults } from "./MlResults";
import { sanitizeStatsError } from "@/lib/errors/sanitize";
import { useDataStore } from "@/store/useDataStore";

interface Props {
  cleaned: Dataset;
  computed: ComputedStats;
  results: StatsResults;
  cleaningDiff: CleaningDiff | null;
  recommendations?: Recommendation[];
}

export function MachineLearningTab({
  cleaned,
  computed,
  recommendations = [],
}: Props) {
  const [task, setTask] = useState<TaskType>("classification");
  const [algorithm, setAlgorithm] = useState("knn");
  const [targetCol, setTargetCol] = useState("");
  const [featureCols, setFeatureCols] = useState<string[]>([]);
  const [testSize, setTestSize] = useState(20);
  const [hyperparams, setHyperparams] = useState<
    Record<string, number | string | null>
  >({});
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [error, setError] = useState("");
  const [featureSearch, setFeatureSearch] = useState("");

  const numericCols = computed.numericCols;
  const allCols = cleaned.columns.map((c) => c.name);
  const targetOptions = task === "regression" ? numericCols : allCols;
  const featureOptions = allCols.filter((c) => c !== targetCol);
  const availableAlgorithms = ALGORITHMS.filter((a) => a.tasks.includes(task));
  const currentAlgo = ALGORITHMS.find((a) => a.key === algorithm);
  const trainingProgress = loading
    ? Math.max(
        6,
        Math.min(94, Math.round(100 * (1 - Math.exp(-elapsed / 6500)))),
      )
    : 0;

  // Recommend algorithm based on data characteristics (via centralized recommendations)
  const algoRecommendation = useMemo(() => {
    const mlAlgoRec = recommendations.find((r) =>
      r.id.startsWith("rec_ml_algo_"),
    );
    if (mlAlgoRec) {
      return {
        key: mlAlgoRec.id.replace("rec_ml_algo_", ""),
        reason: mlAlgoRec.reason,
      };
    }
    return null;
  }, [recommendations]);

  // Filtered feature options for search
  const filteredFeatureOptions = useMemo(() => {
    if (!featureSearch.trim()) return featureOptions;
    const q = featureSearch.toLowerCase();
    return featureOptions.filter((c) => c.toLowerCase().includes(q));
  }, [featureOptions, featureSearch]);

  // Initialize hyperparams when algorithm changes
  useMemo(() => {
    if (!currentAlgo) return;
    const defaults: Record<string, number | string | null> = {};
    for (const hp of currentAlgo.hyperparams) {
      defaults[hp.key] = hp.default;
    }
    setHyperparams(defaults);
  }, [algorithm]);

  const setHp = useCallback((key: string, value: number | string | null) => {
    setHyperparams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleFeature = useCallback((col: string) => {
    setFeatureCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }, []);

  const selectAllNumeric = useCallback(() => {
    setFeatureCols(
      featureOptions.filter((c) => {
        const meta = cleaned.columns.find((col) => col.name === c);
        return meta?.type === "numeric";
      }),
    );
  }, [featureOptions, cleaned.columns]);

  const clearFeatures = useCallback(() => setFeatureCols([]), []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const storagePath = useDataStore((s) => s.storagePath);
  const cleaningConfig = useDataStore((s) => s.cleaningConfig);
  const totalRowCount = useDataStore((s) => s.totalRowCount);
  // G20 dataset-agnostic: preview detection by length vs total, not dataset-specific 690
  const isPreview =
    (totalRowCount ?? 0) > (cleaned.rows.length ?? 0) &&
    cleaned.rows.length > 0;
  const effectiveRowCount = isPreview
    ? (totalRowCount ?? cleaned.rows.length)
    : cleaned.rows.length;
  const isPreviewTruncated = isPreview;

  const handleTrain = useCallback(async () => {
    if (loading) return;
    if (!targetCol) {
      setError("Select a target column");
      return;
    }
    if (featureCols.length === 0) {
      setError("Select at least one feature");
      return;
    }
    // G20: generic valid-row check with counts, not dataset-specific "Approved"
    if (effectiveRowCount < 10) {
      const catCount = featureCols.filter(
        (f) =>
          cleaned.columns.find((c) => c.name === f)?.type === "categorical",
      ).length;
      const previewHint = isPreview ? ` (${cleaned.rows.length} preview)` : "";
      setError(
        `Need at least 10 rows (received ${effectiveRowCount.toLocaleString()} total${previewHint}, ${featureCols.length} features${catCount ? `, ${catCount} categorical → one-hot` : ""}) — check missing data and cleaning`,
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setElapsed(0);

    // Start timer
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);

    // Build hyperparams, stripping nulls for nullable fields
    const hp: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(hyperparams)) {
      if (v !== null && v !== "") hp[k] = v;
    }

    try {
      const trained = await trainModel({
        rows: cleaned.rows,
        columns: cleaned.columns.map((c) => ({ name: c.name, type: c.type })),
        algorithm,
        target: targetCol,
        features: featureCols,
        task,
        testSize: testSize / 100,
        hyperparams: hp,
        storagePath: storagePath ?? undefined,
        totalRowCount: effectiveRowCount,
        cleaningConfig: cleaningConfig ?? undefined,
      });
      setResult(trained);
    } catch (e: unknown) {
      setError(
        sanitizeStatsError(
          e instanceof Error ? e.message : "Failed to connect to ML service",
        ),
      );
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLoading(false);
    }
  }, [
    targetCol,
    featureCols,
    cleaned,
    algorithm,
    task,
    testSize,
    hyperparams,
    storagePath,
    effectiveRowCount,
  ]);

  return (
    <div className="analyse-tab-body analyse-tab-body--compact">
      {/* Config Section */}
      <section className="analyse-section-card ml-panel">
        {/* Row 1: Task + Algorithm + Target + Test split */}
        <div className="ml-row ml-row--top">
          <div className="ml-field">
            <span className="ml-label">Task</span>
            <div className="ml-toggle-group">
              <button
                className={`ml-toggle-btn ${task === "classification" ? "ml-toggle-btn--active" : ""}`}
                onClick={() => {
                  setTask("classification");
                  setAlgorithm("knn");
                  setTargetCol("");
                }}
              >
                Classification
              </button>
              <button
                className={`ml-toggle-btn ${task === "regression" ? "ml-toggle-btn--active" : ""}`}
                onClick={() => {
                  setTask("regression");
                  setAlgorithm("linear_regression");
                  setTargetCol("");
                }}
              >
                Regression
              </button>
            </div>
          </div>

          <div className="ml-field">
            <span className="ml-label">
              Algorithm
              {algoRecommendation && algorithm !== algoRecommendation.key && (
                <span
                  className="ml-recommend"
                  onClick={() => setAlgorithm(algoRecommendation.key)}
                  title={algoRecommendation.reason}
                >
                  &nbsp;· try{" "}
                  {ALGORITHMS.find((a) => a.key === algoRecommendation.key)
                    ?.label ?? algoRecommendation.key}
                </span>
              )}
            </span>
            <div className="ml-custom-select">
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                disabled={loading}
              >
                {availableAlgorithms.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ml-field">
            <span className="ml-label">Target (y)</span>
            <div className="ml-custom-select">
              <select
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
              >
                <option value="">-- select --</option>
                {targetOptions.map((col) => (
                  <option key={col} value={col}>
                    {formatColumnLabel(col)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ml-field ml-field--narrow">
            <span className="ml-label">Test %</span>
            <input
              type="number"
              className="ml-input"
              value={testSize}
              min={10}
              max={50}
              step={5}
              onChange={(e) =>
                setTestSize(
                  Math.max(10, Math.min(50, parseInt(e.target.value) || 20)),
                )
              }
            />
          </div>
        </div>

        {/* Row 2: Hyperparameters */}
        {currentAlgo && currentAlgo.hyperparams.length > 0 && (
          <div className="ml-row ml-row--params">
            <span className="ml-row-title">Hyperparameters</span>
            <div className="ml-params-grid">
              {currentAlgo.hyperparams.map((hp) => (
                <div key={hp.key} className="ml-param">
                  <label className="ml-param-label" title={hp.description}>
                    {hp.label}
                  </label>
                  {hp.type === "enum" ? (
                    <div className="ml-custom-select ml-custom-select--sm">
                      <select
                        value={String(hyperparams[hp.key] ?? hp.default ?? "")}
                        onChange={(e) => setHp(hp.key, e.target.value)}
                      >
                        {hp.options!.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      type="number"
                      className="ml-input ml-input--sm"
                      value={hyperparams[hp.key] ?? ""}
                      placeholder={hp.nullable ? "auto" : String(hp.default)}
                      min={hp.min}
                      max={hp.max}
                      step={hp.step}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" && hp.nullable) {
                          setHp(hp.key, null);
                          return;
                        }
                        const num =
                          hp.type === "float" ? parseFloat(val) : parseInt(val);
                        if (!isNaN(num)) setHp(hp.key, num);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Feature selection */}
        <div className="ml-row ml-row--features">
          <div className="ml-features-head">
            <span className="ml-row-title">
              Features (X) — {featureCols.length} selected
            </span>
            <div className="ml-features-actions">
              {featureOptions.length > 25 && (
                <input
                  className="ml-input ml-input--sm"
                  style={{ maxWidth: 160 }}
                  placeholder="Search columns..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                />
              )}
              <button className="ml-link-btn" onClick={selectAllNumeric}>
                All numeric
              </button>
              <button className="ml-link-btn" onClick={clearFeatures}>
                Clear
              </button>
            </div>
          </div>
          <div className="ml-chips">
            {filteredFeatureOptions.map((col) => {
              const meta = cleaned.columns.find((c) => c.name === col);
              const isNum = meta?.type === "numeric";
              const selected = featureCols.includes(col);
              return (
                <button
                  key={col}
                  className={`ml-chip ${selected ? "ml-chip--on" : ""} ${isNum ? "" : "ml-chip--cat"}`}
                  onClick={() => toggleFeature(col)}
                  title={`${col} (${meta?.type})`}
                >
                  {formatColumnLabel(col)}
                  <span className="ml-chip-badge">{isNum ? "num" : "cat"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {featureCols.some(
          (c) =>
            cleaned.columns.find((col) => col.name === c)?.type ===
            "categorical",
        ) && (
          <div
            className="ml-hint"
            style={{ margin: "8px 0", fontSize: 12, opacity: 0.8 }}
          >
            Categorical features will be auto one-hot encoded before training.
          </div>
        )}

        {/* Train button row */}
        <div className="ml-row ml-row--action">
          <button
            className="ml-train-btn"
            disabled={loading || !targetCol || featureCols.length === 0}
            onClick={handleTrain}
          >
            {loading ? "Training..." : "Train Model"}
          </button>
          {loading ? (
            <div className="ml-loading">
              <div className="ml-loading-head">
                <div className="ml-spinner" />
                <span className="ml-loading-text">
                  Training {trainingProgress}%
                </span>
                <span className="ml-loading-time">
                  {(elapsed / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="ml-progress" aria-hidden="true">
                <div
                  className="ml-progress-bar"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <span
              className="ml-meta"
              title={storagePath ? `storage: ${storagePath}` : "preview rows"}
            >
              {effectiveRowCount.toLocaleString()} rows
              {isPreviewTruncated ? " preview" : ""} · {featureCols.length}{" "}
              feature{featureCols.length !== 1 ? "s" : ""} · {testSize}% test
              {storagePath ? " · full file used for train" : ""}
            </span>
          )}
        </div>

        {error && (
          <div className="ml-error-row">
            <p className="ml-error">{error}</p>
            <button className="ml-retry-btn" onClick={handleTrain}>
              Retry
            </button>
          </div>
        )}
      </section>

      {/* Results */}
      {result && <MlResults result={result} />}
    </div>
  );
}

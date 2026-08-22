/**
 * MlResults — training result sections for the MachineLearningTab.
 */
import type { TrainResult } from "./mlApi";
import { ALGORITHMS } from "./ml-constants";
import { formatColumnLabel } from "@/components/AnalysePanel/analyseHelpers";

function fmtNum(v: unknown, digits = 2, suffix = ""): string {
  return typeof v === "number" && isFinite(v)
    ? v.toFixed(digits) + suffix
    : "—";
}
function fmtPct(v: unknown, digits = 1): string {
  return typeof v === "number" && isFinite(v)
    ? (v * 100).toFixed(digits) + "%"
    : "—";
}

export function MlResults({ result }: { result: TrainResult }) {
  if (!result || !result.metrics) {
    return null;
  }
  const mTest: Record<string, unknown> = (result.metrics.test ?? {}) as Record<
    string,
    unknown
  >;
  const mTrain: Record<string, unknown> = (result.metrics.train ??
    {}) as Record<string, unknown>;
  const cv = result.metrics.crossValidation ?? null;

  return (
    <>
      <section className="analyse-section-card ml-panel">
        <div className="ml-result-header">
          <div>
            <div
              className="ml-section-head"
              style={{ padding: "0 0 10px", borderBottom: "none" }}
            >
              Results
            </div>
            <h3 className="ml-result-title">
              {ALGORITHMS.find((a) => a.key === result.algorithm)?.label ??
                result.algorithm}
              <span className="ml-result-task">{result.task}</span>
            </h3>
          </div>
          <span className="ml-badge">
            {result.task === "classification"
              ? `${fmtPct(mTest.accuracy as number, 1)} acc`
              : `R² ${fmtNum(mTest.r2 as number, 4)}`}
          </span>
        </div>

        {result.warnings && result.warnings.length > 0 && (
          <div className="ml-warnings">
            {result.warnings.map((w, i) => (
              <div key={i} className="ml-warning">
                {w}
              </div>
            ))}
          </div>
        )}

        <div className="ml-metrics">
          {result.task === "classification" ? (
            <>
              <MetricCard
                label="Test accuracy"
                value={fmtPct(mTest.accuracy as number, 1)}
              />
              <MetricCard
                label="Precision"
                value={fmtPct(mTest.precision as number, 1)}
              />
              <MetricCard
                label="Recall"
                value={fmtPct(mTest.recall as number, 1)}
              />
              <MetricCard label="F1" value={fmtPct(mTest.f1 as number, 1)} />
              <MetricCard
                label="Train acc"
                value={fmtPct(mTrain.accuracy as number, 1)}
              />
            </>
          ) : (
            <>
              <MetricCard
                label="Test R²"
                value={fmtNum(mTest.r2 as number, 4)}
              />
              <MetricCard label="MAE" value={fmtNum(mTest.mae as number, 4)} />
              <MetricCard
                label="RMSE"
                value={fmtNum(mTest.rmse as number, 4)}
              />
              <MetricCard
                label="Train R²"
                value={fmtNum(mTrain.r2 as number, 4)}
              />
            </>
          )}
          {cv && (
            <MetricCard
              label={`CV ${cv.folds}-fold`}
              value={`${fmtNum(cv.mean * 100, 1)}% ±${fmtNum(cv.std * 100, 1)}%`}
            />
          )}
        </div>

        <div className="ml-split-bar">
          <span>Train: {result.trainSize}</span>
          <span>Test: {result.testSize}</span>
          {Object.entries(result.hyperparams)
            .slice(0, 5)
            .map(([k, v]) => (
              <span key={k}>
                {k}={String(v)}
              </span>
            ))}
          {Object.keys(result.hyperparams).length > 5 && (
            <span className="ml-split-more">
              +{Object.keys(result.hyperparams).length - 5} more
            </span>
          )}
        </div>
      </section>

      {result.task === "classification" &&
        result.metrics.test.confusionMatrix && (
          <ConfusionMatrix result={result} />
        )}

      {result.featureImportance && result.featureImportance.length > 0 && (
        <FeatureImportance result={result} />
      )}

      {result.predictions.testActual.length > 0 && (
        <Predictions result={result} />
      )}
    </>
  );
}

function ConfusionMatrix({ result }: { result: TrainResult }) {
  const cm = result.metrics.test.confusionMatrix as number[][];
  const cnames = (result.metrics.test.classNames as string[]) ?? [];
  const nClasses = cnames.length;

  // Single class → hide (warning already explains)
  if (nClasses <= 1) return null;

  // Too many classes → show classification report text
  if (nClasses > 10) {
    const flat = cm.flat();
    const total = flat.reduce((a, b) => a + b, 0);
    const correct = cm.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);
    const acc = total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0";
    return (
      <section className="analyse-section-card ml-panel">
        <div className="ml-section-head">
          Confusion matrix — {nClasses} classes
        </div>
        <div className="ml-cm-report">
          <p className="ml-cm-summary">
            Overall accuracy: <strong>{acc}%</strong> ({correct} / {total}{" "}
            correct)
          </p>
          <table className="ml-cm-compact">
            <thead>
              <tr>
                <th>Class</th>
                <th>Correct</th>
                <th>Total</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {cm.map((row, i) => {
                const rowTotal = row.reduce((a, b) => a + b, 0);
                const rowCorrect = row[i] ?? 0;
                const rowAcc =
                  rowTotal > 0
                    ? ((rowCorrect / rowTotal) * 100).toFixed(1)
                    : "—";
                return (
                  <tr key={i}>
                    <td className="ml-cm-class-name" title={cnames[i]}>
                      {truncate(cnames[i], 18)}
                    </td>
                    <td>{rowCorrect}</td>
                    <td>{rowTotal}</td>
                    <td>{rowAcc}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // 2–10 classes → heatmap table
  const maxVal = Math.max(...cm.flat(), 1);
  const isScrollable = nClasses > 5;
  return (
    <section className="analyse-section-card ml-panel">
      <div className="ml-section-head">Confusion matrix</div>
      <div
        className={`ml-table-wrap${isScrollable ? " ml-table-wrap--scroll" : ""}`}
      >
        <table className="ml-cm-table">
          <thead>
            <tr>
              <th></th>
              {cnames.map((c) => (
                <th key={c} title={c}>
                  {truncate(c, 12)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cm.map((row, i) => (
              <tr key={i}>
                <th title={cnames[i]}>{truncate(cnames[i], 12)}</th>
                {row.map((val, j) => {
                  const intensity = val / maxVal;
                  return (
                    <td
                      key={j}
                      className={i === j ? "ml-cm-diag" : ""}
                      style={{
                        backgroundColor:
                          intensity > 0
                            ? `rgba(99, 102, 241, ${(intensity * 0.35).toFixed(2)})`
                            : undefined,
                      }}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FeatureImportance({ result }: { result: TrainResult }) {
  const list = result.featureImportance ?? [];
  if (list.length === 0) return null;
  const firstVal =
    (list[0] as Record<string, unknown>).importance ??
    (list[0] as Record<string, unknown>).coefficient;
  const maxImp =
    typeof firstVal === "number" && isFinite(firstVal as number)
      ? Math.abs(firstVal as number)
      : 0;
  return (
    <section className="analyse-section-card ml-panel">
      <div className="ml-section-head">Feature importance</div>
      <div className="ml-fi-list">
        {list.slice(0, 15).map((fiRaw) => {
          const fi = fiRaw as Record<string, unknown>;
          const val = (fi.importance ?? fi.coefficient) as number;
          const displayVal = fmtNum(val, 4);
          const pct =
            maxImp > 0 && typeof val === "number" && isFinite(val)
              ? (Math.abs(val) / maxImp) * 100
              : 0;
          return (
            <div key={String(fi.feature)} className="ml-fi-row">
              <span className="ml-fi-name">
                {formatColumnLabel(String(fi.feature))}
              </span>
              <div className="ml-fi-track">
                <div className="ml-fi-bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="ml-fi-val">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Predictions({ result }: { result: TrainResult }) {
  const fmtVal = (v: unknown) =>
    result.task === "classification"
      ? String(v)
      : typeof v === "number"
        ? v.toFixed(2)
        : String(v);
  return (
    <section className="analyse-section-card ml-panel">
      <div className="ml-section-head">
        Predictions — first {Math.min(20, result.predictions.testActual.length)}{" "}
        test rows
      </div>
      <div className="ml-table-wrap">
        <table className="ml-pred-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Actual</th>
              <th>Predicted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.predictions.testActual.slice(0, 20).map((actual, i) => {
              const predicted = result.predictions.testPredicted[i];
              const match =
                result.task === "classification"
                  ? actual === predicted
                  : Math.abs(actual - predicted) < Math.abs(actual) * 0.1;
              return (
                <tr key={i} className={match ? "ml-row-ok" : "ml-row-err"}>
                  <td>{i + 1}</td>
                  <td>{fmtVal(actual)}</td>
                  <td>{fmtVal(predicted)}</td>
                  <td>{match ? "\u2713" : "\u2717"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ml-metric">
      <span className="ml-metric-lbl">{label}</span>
      <strong className="ml-metric-val">{value}</strong>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "\u2026";
}

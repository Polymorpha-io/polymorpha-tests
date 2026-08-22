import { useState } from "react";
import {
  recommendStageStreaming,
  type RecommendStage,
} from "@/lib/recommend/recommendService";
import { useDataStore } from "@/store/useDataStore";
import { useRagStore } from "@/store/useRagStore";
import { getStageCatalog } from "@/lib/recommend/catalog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./RecommendButton.css";

interface Props {
  stage: RecommendStage;
  label?: string;
}

export function RecommendButton({ stage, label = "Recommend a Step" }: Props) {
  const objective = useDataStore((s) => s.objective);
  const isProfiling = useRagStore((s) => s.isProfiling);
  const profile = useRagStore((s) => s.profile);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");

  const handleClick = async () => {
    if (!objective) {
      setError("Set your objective first (popup after upload).");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStreaming("");
    let full = "";
    await recommendStageStreaming(
      stage,
      (tok) => {
        full += tok;
        setStreaming(full);
      },
      (done) => {
        setResult(done);
        setStreaming("");
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  };

  const isDisabled = loading || isProfiling;

  return (
    <div className="recommend-wrap">
      <button
        type="button"
        className="recommend-btn"
        onClick={handleClick}
        disabled={isDisabled}
        title={
          !objective
            ? "Set objective after upload"
            : isProfiling
              ? "RAG still profiling…"
              : label
        }
      >
        <span className="recommend-btn-icon">✦</span>
        {loading ? "Recommending…" : label}
      </button>

      {!objective && (
        <span className="recommend-hint">Set objective to enable</span>
      )}
      {isProfiling && objective && (
        <span className="recommend-hint">RAG profiling…</span>
      )}

      {(streaming || result) && (
        <div className="recommend-result" role="status" aria-live="polite">
          <div className="recommend-result-header">
            Based on your data, you are recommended to do the following:
          </div>
          <div className="recommend-result-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {((result ?? streaming) || "").replace(
                /^Based on your data, you are recommended to do the following:\s*/i,
                "",
              )}
            </ReactMarkdown>
          </div>
          {result && (
            <div className="recommend-catalog">
              <div className="recommend-catalog-title">
                Other methods available in{" "}
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </div>
              {(() => {
                const items = getStageCatalog(stage, profile, {
                  canAdvanced: true,
                  objective: objective ?? "",
                });
                const byGroup = new Map<string, typeof items>();
                for (const it of items) {
                  const g = it.group;
                  if (!byGroup.has(g)) byGroup.set(g, []);
                  byGroup.get(g)!.push(it);
                }
                return Array.from(byGroup.entries()).map(
                  ([group, groupItems]) => (
                    <div key={group} className="recommend-catalog-group">
                      <div className="recommend-catalog-group-label">
                        {group}
                      </div>
                      <div className="recommend-catalog-items">
                        {groupItems.map((it) => (
                          <span
                            key={it.id}
                            className={`recommend-catalog-item recommend-catalog-item--${it.state}`}
                            title={`${it.purpose} — requires: ${it.requires} — ${it.uiPath} — ${it.state}`}
                          >
                            {it.label} —{" "}
                            {it.state === "locked"
                              ? "🔒 Not currently available"
                              : it.state === "applicable"
                                ? "✓ Applicable"
                                : "Available"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ),
                );
              })()}
              <div className="recommend-catalog-hint">
                Catalog is deterministic — the LLM selects only the Recommended
                next step above.
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="recommend-error">{error}</div>}
    </div>
  );
}

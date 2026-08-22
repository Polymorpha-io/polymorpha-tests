import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDataStore } from "@/store/useDataStore";
import {
  autoDetectEncoding,
  countColumnDelta,
  getEncodingPreview,
  getUniqueValues,
} from "@polymorpha/business-logic";
import type { EncodingConfig, EncodingType } from "@/types";

const ENCODING_LABELS: Record<EncodingType, string> = {
  none: "Keep as string",
  binary: "Binary (0 / 1)",
  label: "Label encoding",
  onehot: "One-hot encoding",
  ordinal: "Ordinal (custom order)",
  frequency: "Frequency encoding",
};

const ENCODING_DESC: Record<EncodingType, string> = {
  none: "No conversion, stays categorical.",
  binary: "2 values mapped to 0 and 1. Works for Yes/No, Male/Female, etc.",
  label:
    "Each unique value gets an integer (0, 1, 2 …). Best for high-cardinality.",
  onehot:
    "Creates one binary column per unique value. Best for nominal (unordered) with ≤ 8 values.",
  ordinal:
    "Assign a custom rank to each value (e.g. Low → 0, Med → 1, High → 2).",
  frequency:
    "Replace each category with how often it appears. Useful when cardinality is high.",
};

const MINI_DICT = [
  {
    term: "Binary Encoding",
    detail: "For exactly 2 categories. Maps values to 0 and 1.",
    useWhen: "Use for yes/no or two-class variables.",
  },
  {
    term: "One-hot Encoding",
    detail: "Creates one indicator column per category.",
    useWhen: "Best for nominal categories with small-to-medium cardinality.",
  },
  {
    term: "Label Encoding",
    detail: "Maps each category to an integer code.",
    useWhen: "Useful for high-cardinality features or tree-based models.",
  },
  {
    term: "Ordinal Encoding",
    detail: "Applies user-defined rank order to categories.",
    useWhen:
      "Use only when category order has real meaning (Low < Medium < High).",
  },
  {
    term: "Cardinality",
    detail: "Number of unique categories in a column.",
    useWhen: "Use this to choose one-hot vs label strategy.",
  },
];

function cardinalityBadge(n: number): { label: string; cls: string } {
  if (n === 2) return { label: "Binary → 0/1", cls: "card-badge--ok" };
  if (n <= 6)
    return { label: `${n} values → One-hot`, cls: "card-badge--info" };
  if (n <= 10)
    return { label: `${n} values → Label/One-hot`, cls: "card-badge--warn" };
  return { label: `${n} values, high cardinality`, cls: "card-badge--danger" };
}

interface EncodingModalProps {
  onClose?: () => void;
  inline?: boolean;
}

export function EncodingModal({ onClose, inline = false }: EncodingModalProps) {
  const { raw, cleaningConfig, setCleaningConfig } = useDataStore(
    useShallow((s) => ({
      raw: s.raw,
      cleaningConfig: s.cleaningConfig,
      setCleaningConfig: s.setCleaningConfig,
    })),
  );

  // Local copy of encodings — committed on Apply
  const [local, setLocal] = useState<Record<string, EncodingConfig>>(
    () => cleaningConfig?.encodings ?? {},
  );

  // For ordinal: which column is being re-ordered
  const [ordinalEdit, setOrdinalEdit] = useState<string | null>(null);
  const [selectedCol, setSelectedCol] = useState<string | null>(() => null);
  const [showGlossary, setShowGlossary] = useState(false);

  const catCols = useMemo(
    () => (raw?.columns ?? []).filter((c) => c.type === "categorical"),
    [raw],
  );

  const activeCol =
    catCols.find((c) => c.name === selectedCol) ?? catCols[0] ?? null;
  const highCardinalityColumns = useMemo(
    () =>
      catCols.filter(
        (column) => getUniqueValues(raw?.rows ?? [], column.name).length > 10,
      ),
    [catCols, raw?.rows],
  );

  const samplePreview = useMemo(() => {
    if (!raw || !activeCol) return null;

    const cfg = local[activeCol.name] ?? { type: "none" as const };
    const uniq = getUniqueValues(raw.rows, activeCol.name);
    const sampleValues = uniq.slice(0, 4);
    const safeName = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "_");

    if (cfg.type === "onehot") {
      const headers = uniq.map(
        (value) => `${activeCol.name}_${safeName(value)}`,
      );
      const visibleHeaders = headers.slice(0, 4);
      const rows = sampleValues.map((value) => ({
        value,
        values: visibleHeaders.map((header) =>
          header === `${activeCol.name}_${safeName(value)}` ? "1" : "0",
        ),
      }));

      return {
        title: "One-hot preview",
        note: `Creates ${headers.length} binary columns.`,
        kind: "onehot" as const,
        headers: visibleHeaders,
        moreCount: Math.max(0, headers.length - visibleHeaders.length),
        rows,
      };
    }

    const rows = sampleValues.map((value, index) => {
      if (cfg.type === "binary") {
        return { original: value, encoded: String(index) };
      }
      if (cfg.type === "label") {
        return { original: value, encoded: String(index) };
      }
      if (cfg.type === "ordinal") {
        return { original: value, encoded: String(index) };
      }
      if (cfg.type === "frequency") {
        return {
          original: value,
          encoded: String(
            raw.rows.filter(
              (row) => String(row[activeCol.name] ?? "") === value,
            ).length,
          ),
        };
      }
      return { original: value, encoded: "kept as text" };
    });

    const mapping = getEncodingPreview(raw.rows, activeCol.name, cfg);

    return {
      title: ENCODING_LABELS[cfg.type],
      note:
        cfg.type === "none"
          ? "The column stays exactly as it is."
          : cfg.type === "binary"
            ? "Two categories become 0 and 1."
            : cfg.type === "label"
              ? "Each category becomes an integer code."
              : cfg.type === "frequency"
                ? "Each category becomes its observed count in the dataset."
                : "Categories are mapped using the custom order shown below.",
      kind: cfg.type,
      rows,
      mapping,
    };
  }, [activeCol, local, raw]);

  if (!raw || !cleaningConfig) return null;

  const origCount = raw.columns.length;
  const delta = countColumnDelta(raw.columns, local, raw.rows);
  const afterCount = origCount + delta;

  const setEncoding = (colName: string, cfg: EncodingConfig) => {
    setLocal((prev) => ({ ...prev, [colName]: cfg }));
    if (ordinalEdit === colName && cfg.type !== "ordinal") setOrdinalEdit(null);
  };

  const handleAutoNumeric = () => {
    const next: Record<string, EncodingConfig> = {};
    for (const col of catCols) {
      next[col.name] = autoDetectEncoding(raw.rows, col.name);
    }
    setLocal(next);
  };

  const handleKeepAll = () => {
    const next: Record<string, EncodingConfig> = {};
    for (const col of catCols) next[col.name] = { type: "none" };
    setLocal(next);
  };

  const handleApply = () => {
    setCleaningConfig({ ...cleaningConfig, encodings: local });
    onClose?.();
  };

  const content = (
    <div
      className={`modal-panel${inline ? " modal-panel--inline" : ""}`}
      role={inline ? undefined : "dialog"}
      aria-modal={inline ? undefined : true}
      aria-label="Feature Engineering"
    >
      {/* Header */}
      <div className="modal-header">
        <div>
          <h2>Feature Engineering</h2>
          <p className="modal-subtitle">
            Convert categorical columns to numbers so every algorithm can use
            them.
          </p>
        </div>
        {!inline && (
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      {/* Column count badge */}
      <div className="modal-column-count">
        <span className="mcc-label">Columns after encoding:</span>
        <span className="mcc-orig">{origCount} original</span>
        <span className="mcc-arrow">→</span>
        <span
          className={`mcc-after${delta !== 0 ? " mcc-after--changed" : ""}`}
        >
          {afterCount}
        </span>
        {delta > 0 && <span className="mcc-delta">+{delta} from one-hot</span>}
      </div>

      {/* Wizard buttons */}
      <div className="modal-wizard">
        <button className="btn-primary btn-sm" onClick={handleAutoNumeric}>
          Auto-numeric detect best encoding per column
        </button>
        <button className="btn-ghost btn-sm" onClick={handleKeepAll}>
          Keep all as string
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => setShowGlossary((value) => !value)}
        >
          {showGlossary ? "Hide glossary" : "Show glossary"}
        </button>
      </div>

      {highCardinalityColumns.length > 0 && (
        <div className="enc-summary-bar">
          <strong>High-cardinality columns:</strong>
          <span>
            {highCardinalityColumns.map((column) => column.name).join(", ")}
          </span>
          <span className="enc-summary-note">
            Prefer label or frequency encoding unless you explicitly want many
            one-hot columns.
          </span>
        </div>
      )}

      {showGlossary && (
        <section className="enc-glossary-panel" aria-label="Encoding glossary">
          <h4>Encoding glossary</h4>
          <div className="enc-mini-dict-grid">
            {MINI_DICT.map((item) => (
              <article key={item.term} className="enc-mini-dict-card">
                <div className="enc-mini-dict-term">{item.term}</div>
                <p className="enc-mini-dict-detail">{item.detail}</p>
                <p className="enc-mini-dict-use">{item.useWhen}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Focus-first conversion + sample preview */}
      {catCols.length === 0 ? (
        <div className="modal-empty">
          No categorical columns detected in this dataset.
        </div>
      ) : (
        <div className="modal-body">
          <div className="modal-table-wrap">
            {activeCol &&
              (() => {
                const cfg = local[activeCol.name] ?? { type: "none" as const };
                const uniq = getUniqueValues(raw.rows, activeCol.name);
                const preview = getEncodingPreview(
                  raw.rows,
                  activeCol.name,
                  cfg,
                );
                const availableTypes: EncodingType[] =
                  uniq.length === 2
                    ? ["none", "binary", "label", "onehot", "frequency"]
                    : ["none", "label", "onehot", "ordinal", "frequency"];
                return (
                  <div className="enc-focus-panel">
                    <label className="clean-focus-field">
                      Choose a categorical column first
                      <select
                        className="clean-select"
                        value={activeCol.name}
                        onChange={(e) => setSelectedCol(e.target.value)}
                      >
                        {catCols.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="clean-focus-chips">
                      {catCols.slice(0, 10).map((col) => (
                        <button
                          key={col.name}
                          className={`clean-focus-chip${col.name === activeCol.name ? " is-active" : ""}`}
                          onClick={() => setSelectedCol(col.name)}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                    <div className="enc-focus-card">
                      <div className="enc-focus-head">
                        <h4>{activeCol.name}</h4>
                        <span
                          className={`card-badge ${cardinalityBadge(uniq.length).cls}`}
                        >
                          {cardinalityBadge(uniq.length).label}
                        </span>
                      </div>
                      <p className="enc-type-desc">
                        Unique values: {uniq.length}. {ENCODING_DESC[cfg.type]}
                      </p>
                      <div className="enc-focus-grid">
                        <label>
                          Convert to
                          <select
                            className="enc-select"
                            value={cfg.type}
                            onChange={(e) => {
                              const t = e.target.value as EncodingType;
                              if (t === "ordinal") {
                                setEncoding(activeCol.name, {
                                  type: "ordinal",
                                  ordinalOrder: uniq,
                                });
                                setOrdinalEdit(activeCol.name);
                              } else {
                                setEncoding(activeCol.name, {
                                  type: t,
                                  dropFirst: cfg.dropFirst ?? false,
                                });
                              }
                            }}
                          >
                            {availableTypes.map((t) => (
                              <option key={t} value={t}>
                                {ENCODING_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Preview mapping
                          <div className="enc-preview">{preview}</div>
                        </label>
                      </div>
                      {cfg.type === "onehot" && (
                        <label className="checkbox-label enc-inline-check">
                          <input
                            type="checkbox"
                            checked={cfg.dropFirst ?? false}
                            onChange={(e) =>
                              setEncoding(activeCol.name, {
                                ...cfg,
                                dropFirst: e.target.checked,
                              })
                            }
                          />
                          Drop first category
                        </label>
                      )}
                      {ordinalEdit === activeCol.name &&
                        cfg.type === "ordinal" && (
                          <div className="enc-ordinal-wrap">
                            <OrdinalOrderEditor
                              values={cfg.ordinalOrder ?? uniq}
                              onChange={(order) =>
                                setEncoding(activeCol.name, {
                                  type: "ordinal",
                                  ordinalOrder: order,
                                })
                              }
                            />
                          </div>
                        )}
                    </div>
                  </div>
                );
              })()}
          </div>

          <aside className="modal-sample-panel">
            <div className="modal-sample-head">
              <div>
                <div className="modal-sample-kicker">Live sample</div>
                <h3>{activeCol?.name ?? "Select a column"}</h3>
              </div>
              {activeCol && (
                <span
                  className={`card-badge ${cardinalityBadge(getUniqueValues(raw.rows, activeCol.name).length).cls}`}
                >
                  {
                    cardinalityBadge(
                      getUniqueValues(raw.rows, activeCol.name).length,
                    ).label
                  }
                </span>
              )}
            </div>

            {activeCol && samplePreview && (
              <>
                <p className="modal-sample-note">{samplePreview.note}</p>
                <div className="modal-sample-mapping">
                  {samplePreview.mapping}
                </div>

                {samplePreview.kind === "onehot" ? (
                  <table className="sample-table sample-table--matrix">
                    <thead>
                      <tr>
                        <th>Value</th>
                        {samplePreview.headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                        {samplePreview.moreCount > 0 && (
                          <th>+{samplePreview.moreCount}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {samplePreview.rows.map((row) => (
                        <tr key={row.value}>
                          <td className="sample-value">{row.value}</td>
                          {row.values.map((cell, idx) => (
                            <td key={`${row.value}-${idx}`}>{cell}</td>
                          ))}
                          {samplePreview.moreCount > 0 && (
                            <td className="sample-muted">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="sample-table">
                    <thead>
                      <tr>
                        <th>Original</th>
                        <th>Encoded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samplePreview.rows.map((row) => (
                        <tr key={row.original}>
                          <td className="sample-value">{row.original}</td>
                          <td className="sample-encoded">{row.encoded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      <div className="modal-footer">
        {!inline && (
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        )}
        {(() => {
          const count = Object.values(local).filter(
            (c) => c.type !== "none",
          ).length;
          return (
            <button
              className={count > 0 ? "btn-primary" : "btn-ghost"}
              onClick={handleApply}
              disabled={count === 0}
            >
              Apply encoding ({count} column{count !== 1 ? "s" : ""})
            </button>
          );
        })()}
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {content}
    </div>
  );
}

// Ordinal order drag-and-drop (simplified: up/down buttons)

function OrdinalOrderEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (order: string[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const next = [...values];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="ordinal-editor">
      <p className="ordinal-editor-hint">
        Drag or use arrows to set order. Left = 0 (lowest), right = highest.
      </p>
      <div className="ordinal-chips">
        {values.map((v, i) => (
          <div key={v} className="ordinal-chip">
            <span className="ordinal-chip-rank">{i}</span>
            <span className="ordinal-chip-val">{v}</span>
            <div className="ordinal-chip-btns">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                title="Move left"
              >
                ◀
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === values.length - 1}
                title="Move right"
              >
                ▶
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

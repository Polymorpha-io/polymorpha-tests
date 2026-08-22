/**
 * DictionaryTermPage — the full SEO term article page.
 */
import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import katex from "katex";
import DOMPurify from "dompurify";
import {
  CATEGORY_LABELS,
  DICTIONARY_TERMS,
  type DictionaryCategory,
  type DictionaryEntry,
} from "@polymorpha/business-logic";
import { goBackOrFallback, metricBarWidth, termUrl } from "./dictionaryShared";
import { shouldShowVisualSuggestion, VisualChart } from "./DictionaryVisuals";

function EquationFormula({ formula }: { formula: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        throwOnError: true,
        displayMode: false,
        strict: "ignore",
      });
    } catch {
      return null;
    }
  }, [formula]);

  if (!html) {
    return <code>{formula}</code>;
  }

  return (
    <span
      className="dict-seo-katex"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

export function TermPage({ term }: { term: DictionaryEntry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const categoryPath = `/dictionary/${term.category}`;
  const categoryOrder: DictionaryCategory[] = [
    "descriptive",
    "inference",
    "normality",
    "correlation",
    "cleaning",
    "encoding",
    "data-types",
    "ingestion",
    "regression",
    "visualization",
    "workflow",
    "export",
    "libraries",
  ];

  const navGroups: Array<{ title: string; cats: DictionaryCategory[] }> = [
    {
      title: "Start with the basics",
      cats: ["descriptive", "inference", "normality", "correlation"],
    },
    {
      title: "Prepare the data",
      cats: ["cleaning", "encoding", "data-types", "ingestion"],
    },
    {
      title: "Models, visuals, and system",
      cats: ["regression", "visualization", "workflow", "export", "libraries"],
    },
  ];

  const termsByCategory = useMemo(() => {
    const map = new Map<DictionaryCategory, DictionaryEntry[]>();
    for (const cat of categoryOrder) {
      map.set(
        cat,
        DICTIONARY_TERMS.filter(
          (t) => t.category === cat && !t.libraryInternal,
        ),
      );
    }
    return map;
  }, []);

  useEffect(() => {
    document.title = `${term.term} — Statistics Dictionary | Polymorpha`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", term.definition.slice(0, 155));
  }, [term]);

  return (
    <main className="dict-seo-page dict-seo-page--term">
      <div className="dict-seo-topbar">
        <button
          type="button"
          className="back-btn"
          aria-label="Go back"
          onClick={() =>
            goBackOrFallback(navigate, location.state, categoryPath)
          }
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="10 3 5 8 10 13" />
          </svg>
          Back
        </button>
      </div>
      <nav className="dict-seo-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Polymorpha</Link>
        <span aria-hidden="true"> / </span>
        <span>Dictionary</span>
        <span aria-hidden="true"> / </span>
        <span className="dict-seo-breadcrumb-current">
          {CATEGORY_LABELS[term.category]}
        </span>
        <span aria-hidden="true"> / </span>
        <span>{term.term}</span>
      </nav>

      <div className="dict-seo-term-layout">
        <aside className="dict-seo-term-index" aria-label="Dictionary index">
          <div className="dict-seo-term-index-title">Concept groups</div>
          {navGroups.map((group) => (
            <div key={group.title} className="dict-seo-term-index-group">
              <p className="dict-seo-term-index-group-title">{group.title}</p>
              {group.cats.map((cat) => {
                const terms = termsByCategory.get(cat) || [];
                if (terms.length === 0) return null;
                return (
                  <div key={cat} className="dict-seo-term-index-subgroup">
                    <p
                      className={`dict-seo-term-index-category${term.category === cat ? " active" : ""}`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </p>
                    <div className="dict-seo-term-index-links">
                      {terms.map((navTerm) => (
                        <Link
                          key={navTerm.id}
                          to={termUrl(navTerm)}
                          state={{ from: location.pathname }}
                          className={`dict-seo-term-index-link${navTerm.id === term.id ? " active" : ""}`}
                        >
                          {navTerm.term}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        <article
          className="dict-seo-article"
          itemScope
          itemType="https://schema.org/DefinedTerm"
        >
          <header className="dict-entry-head dict-seo-term-head">
            <div className="dict-entry-head-copy">
              <p className="dict-entry-kicker">
                {CATEGORY_LABELS[term.category]}
              </p>
              <h1 className="dict-seo-term-title" itemProp="name">
                {term.term}
              </h1>
              {term.quickTake && (
                <p className="dict-entry-quicktake">{term.quickTake}</p>
              )}
            </div>
          </header>

          <section className="dict-seo-section dict-row">
            <h2 className="dict-label">Definition</h2>
            <p itemProp="description">{term.definition}</p>
          </section>

          {term.detailedExplanation && (
            <section className="dict-seo-section dict-row dict-seo-indepth">
              <h2 className="dict-label">In Depth</h2>
              <p>{term.detailedExplanation}</p>
            </section>
          )}

          {term.concept && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Key Concept</h2>
              <p>{term.concept}</p>
            </section>
          )}

          {term.example && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Practical Example</h2>
              <p>{term.example}</p>
            </section>
          )}

          {term.analogy && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Analogy</h2>
              <p>{term.analogy}</p>
            </section>
          )}

          {shouldShowVisualSuggestion(term) && (
            <section className="dict-seo-section dict-row dict-seo-visual-card dict-seo-visual-compact">
              <VisualChart vis={term.visualSuggestion!} />
            </section>
          )}

          {term.widgets && term.widgets.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Quick Signals</h2>
              <div className="dict-seo-widget-grid">
                {term.widgets.map((widget, i) => (
                  <article
                    key={`${widget.label}-${i}`}
                    className={`dict-seo-widget dict-seo-widget--${widget.tone || "neutral"}`}
                  >
                    <span className="dict-seo-widget-label">
                      {widget.label}
                    </span>
                    <strong className="dict-seo-widget-value">
                      {widget.value}
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          )}

          {term.miniChart && term.miniChart.items.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Mini Chart</h2>
              <div
                className="dict-seo-mini-bars"
                role="img"
                aria-label={`${term.term} mini chart`}
              >
                {term.miniChart.items.map((item) => (
                  <div className="dict-seo-mini-row" key={item.label}>
                    <span className="dict-seo-mini-label">{item.label}</span>
                    <div className="dict-seo-mini-track">
                      <span
                        className="dict-seo-mini-fill"
                        style={{ width: metricBarWidth(item.value) }}
                      />
                    </div>
                    <span className="dict-seo-mini-value">
                      {item.value}
                      {term.miniChart?.unit ? ` ${term.miniChart.unit}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {term.whenToUse && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">When to Use</h2>
              <p>{term.whenToUse}</p>
            </section>
          )}

          {term.assumptions && term.assumptions.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Assumptions</h2>
              <ul className="dict-bullet-list">
                {term.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {term.equation && (
            <section className="dict-seo-section dict-row dict-row-eq">
              <h2 className="dict-label">Formula</h2>
              <p className="dict-seo-formula">
                <strong>{term.equation.label}:</strong>{" "}
                <EquationFormula formula={term.equation.formula} />
              </p>
              {term.equation.meaning && <p>{term.equation.meaning}</p>}
              {term.equation.inputs && term.equation.inputs.length > 0 && (
                <div className="dict-seo-eq-where">
                  <p className="dict-seo-eq-where-label">
                    <strong>Where:</strong>
                  </p>
                  <dl className="dict-seo-eq-parts">
                    {term.equation.inputs.map((input, i) => {
                      const colonIdx = input.indexOf(":");
                      if (colonIdx <= 0) return <dd key={i}>{input}</dd>;
                      const sym = input.slice(0, colonIdx).trim();
                      const meaning = input.slice(colonIdx + 1).trim();
                      return (
                        <div key={i} className="dict-seo-eq-part">
                          <dt>
                            <EquationFormula formula={sym} />
                          </dt>
                          <dd>{meaning}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}
              {term.equation.output && (
                <p>
                  <strong>Output:</strong> {term.equation.output}
                </p>
              )}
              {term.equation.notes && (
                <p>
                  <strong>Notes:</strong> {term.equation.notes}
                </p>
              )}
            </section>
          )}

          {term.interpretation &&
            (term.interpretation.rule ||
              (term.interpretation.ranges &&
                term.interpretation.ranges.length > 0)) && (
              <section className="dict-seo-section dict-row">
                <h2 className="dict-label">Interpretation</h2>
                {term.interpretation.rule && <p>{term.interpretation.rule}</p>}
                {term.interpretation.ranges &&
                  term.interpretation.ranges.length > 0 && (
                    <table className="dict-seo-table">
                      <thead>
                        <tr>
                          <th>Min</th>
                          <th>Max</th>
                          <th>Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.interpretation.ranges.map((range, i) => (
                          <tr key={i}>
                            <td>{range.min}</td>
                            <td>{range.max}</td>
                            <td>{range.meaning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </section>
            )}

          {term.sampleTable && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Before and After Table</h2>
              <div className="dict-seo-table-grid">
                <div>
                  <p className="dict-seo-table-title">Before</p>
                  <table className="dict-seo-table">
                    <thead>
                      <tr>
                        {term.sampleTable.columns.map((col) => (
                          <th key={`before-${col}`}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {term.sampleTable.before.map((row, rowIndex) => (
                        <tr key={`before-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`before-${rowIndex}-${cellIndex}`}>
                              {cell || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {term.sampleTable.after && (
                  <div>
                    <p className="dict-seo-table-title">After</p>
                    <table className="dict-seo-table">
                      <thead>
                        <tr>
                          {term.sampleTable.columns.map((col) => (
                            <th key={`after-${col}`}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {term.sampleTable.after.map((row, rowIndex) => (
                          <tr key={`after-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              <td key={`after-${rowIndex}-${cellIndex}`}>
                                {cell || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {term.tabularExample && term.tabularExample.headers.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Tabular Example</h2>
              <table className="dict-seo-table">
                <thead>
                  <tr>
                    {term.tabularExample.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {term.tabularExample.rows.map((row, rowIndex) => (
                    <tr key={`tabular-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`tabular-${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {term.markdown && (
            <section className="dict-seo-section dict-row dict-seo-notes">
              <h2 className="dict-label">Notes</h2>
              <div className="dict-seo-notes-body">
                {term.markdown
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => {
                    const trimmed = line.trim();
                    const content = trimmed.startsWith("- ")
                      ? trimmed.slice(2)
                      : trimmed;
                    const parts = content
                      .split(/(\*\*(?:(?!\*\*).)+\*\*)/g)
                      .filter(Boolean);
                    const rendered = parts.map((part, j) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                    });
                    if (trimmed.startsWith("- "))
                      return (
                        <p key={i} className="dict-seo-notes-bullet">
                          {rendered}
                        </p>
                      );
                    return <p key={i}>{rendered}</p>;
                  })}
              </div>
            </section>
          )}

          {term.pitfalls && term.pitfalls.length > 0 && (
            <section className="dict-seo-section dict-row dict-row-pitfall">
              <h2 className="dict-label">Common Pitfalls</h2>
              <ul className="dict-bullet-list">
                {term.pitfalls.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {term.misconceptions && term.misconceptions.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Misconceptions</h2>
              <ul className="dict-bullet-list">
                {term.misconceptions.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </section>
          )}

          {term.alternatives && term.alternatives.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Alternatives</h2>
              <ul className="dict-bullet-list">
                {term.alternatives.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          {term.relatedTerms && term.relatedTerms.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Related Terms</h2>
              <ul className="dict-seo-related">
                {term.relatedTerms.map((rt) => {
                  const linked = DICTIONARY_TERMS.find(
                    (t) =>
                      t.term.toLowerCase() === rt.toLowerCase() ||
                      t.id === rt.toLowerCase().replace(/\s+/g, "-"),
                  );
                  return (
                    <li key={rt}>
                      {linked ? (
                        <Link
                          to={termUrl(linked)}
                          state={{ from: location.pathname }}
                        >
                          {rt}
                        </Link>
                      ) : (
                        rt
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {term.citations && term.citations.length > 0 && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">References</h2>
              <ol className="dict-seo-citations">
                {term.citations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            </section>
          )}

          {term.reference && (
            <section className="dict-seo-section dict-row">
              <h2 className="dict-label">Reference Note</h2>
              <p>{term.reference}</p>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}

/**
 * DictionaryIndex — the dictionary landing page with search + category overview.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CATEGORY_LABELS,
  DICTIONARY_TERMS,
  type DictionaryCategory,
  type DictionaryEntry,
} from "@polymorpha/business-logic";
import { goBackOrFallback, termUrl } from "./dictionaryShared";

export function DictionaryIndex() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  useEffect(() => {
    document.title =
      "Statistics Dictionary — Polymorpha | Definitions, Formulas & Methods";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        "Browse definitions, formulas, and explanations for statistical tests, data cleaning methods, and analysis techniques used in Polymorpha.",
      );
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<DictionaryCategory, DictionaryEntry[]>();
    for (const term of DICTIONARY_TERMS) {
      if (term.libraryInternal) continue;
      const list = map.get(term.category) || [];
      list.push(term);
      map.set(term.category, list);
    }
    return map;
  }, []);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const map = new Map<DictionaryCategory, DictionaryEntry[]>();
    for (const [cat, terms] of grouped) {
      const matched = terms.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q),
      );
      if (matched.length > 0) map.set(cat, matched);
    }
    return map;
  }, [grouped, search]);

  return (
    <main className="dict-seo-page">
      <div className="dict-seo-topbar">
        <button
          type="button"
          className="back-btn"
          aria-label="Go back"
          onClick={() => goBackOrFallback(navigate, location.state, "/")}
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
      </nav>

      <h1>Statistics Dictionary</h1>
      <p className="dict-seo-intro">
        Definitions, formulas, assumptions, and practical guidance for all
        statistical methods and data cleaning techniques.
      </p>

      <div className="dict-search-wrap">
        <input
          className="dict-search-input"
          type="search"
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredGrouped.size === 0 && (
        <p className="dict-seo-intro">No terms match "{search}".</p>
      )}

      {Array.from(filteredGrouped.entries()).map(([category, terms]) => (
        <section key={category} className="dict-seo-category-section">
          <h2>
            <Link
              to={`/dictionary/${category}`}
              state={{ from: location.pathname }}
            >
              {CATEGORY_LABELS[category]}
            </Link>
          </h2>
          <ul className="dict-seo-term-list">
            {terms.map((term) => (
              <li key={term.id} className="dict-entry-card dict-seo-list-card">
                <Link
                  to={termUrl(term)}
                  state={{ from: location.pathname }}
                  className="dict-seo-list-link"
                >
                  <strong>{term.term}</strong>
                </Link>
                <span className="dict-seo-term-def">
                  {term.definition.slice(0, 120)}
                  {term.definition.length > 120 ? "…" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

/**
 * DictionaryCategoryPage — lists all terms in a dictionary category.
 */
import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CATEGORY_LABELS,
  DICTIONARY_TERMS,
  type DictionaryCategory,
} from "@polymorpha/business-logic";
import { goBackOrFallback, termUrl } from "./dictionaryShared";

export function CategoryPage({ category }: { category: DictionaryCategory }) {
  const navigate = useNavigate();
  const location = useLocation();
  const terms = useMemo(
    () =>
      DICTIONARY_TERMS.filter(
        (t) => t.category === category && !t.libraryInternal,
      ),
    [category],
  );
  const label = CATEGORY_LABELS[category];

  useEffect(() => {
    document.title = `${label} — Statistics Dictionary | Polymorpha`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        `Browse definitions and formulas for ${label.toLowerCase()} concepts in Polymorpha.`,
      );
  }, [label]);

  return (
    <main className="dict-seo-page">
      <div className="dict-seo-topbar">
        <button
          type="button"
          className="back-btn"
          aria-label="Go back"
          onClick={() =>
            goBackOrFallback(navigate, location.state, "/dictionary")
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
        <span>{label}</span>
      </nav>

      <h1>{label}</h1>
      <p className="dict-seo-intro">
        Definitions, formulas, and practical guidance for {label.toLowerCase()}{" "}
        concepts used in Polymorpha.
      </p>
      <p className="dict-seo-hint">
        Click any term below to open the full definition page.
      </p>

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
    </main>
  );
}

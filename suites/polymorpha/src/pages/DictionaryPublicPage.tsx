/**
 * DictionaryPublicPage — router shell for the public statistics dictionary.
 */
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CATEGORY_LABELS, DICTIONARY_TERMS } from "@polymorpha/business-logic";
import type { DictionaryCategory } from "@polymorpha/business-logic";
import { CategoryPage } from "./dictionary/DictionaryCategoryPage";
import { DictionaryIndex } from "./dictionary/DictionaryIndex";
import { TermPage } from "./dictionary/DictionaryTermPage";
import "katex/dist/katex.min.css";
import "./css/dict/dict-search.css";
import "./css/dict/dict-index.css";
import "./css/dict/dict-breadcrumb.css";
import "./css/dict/dict-header.css";
import "./css/dict/dict-article.css";
import "./css/dict/dict-visual.css";
import "./css/dict/dict-notes.css";
import "./css/dict/dict-usage.css";
import "./css/dict/dict-widgets.css";
import "./css/dict/dict-table.css";
import "./css/dict/dict-extras.css";
import "./css/dict/dict-cta.css";
import "./css/dict/dict-category.css";

function NotFound({ message }: { message: string }) {
  return (
    <main className="dict-seo-page">
      <h1>Not Found</h1>
      <p>{message}</p>
      <Link to="/dictionary">Browse all terms</Link>
    </main>
  );
}

export function DictionaryPublicPage() {
  const { category, termId } = useParams<{
    category?: string;
    termId?: string;
  }>();
  const navigate = useNavigate();

  // On desktop with no params, redirect to descriptive-statistics as default term
  useEffect(() => {
    if (!category && !termId && window.innerWidth >= 768) {
      navigate("/dictionary/descriptive/descriptive-statistics", {
        replace: true,
      });
    }
  }, [category, termId, navigate]);

  // If category is provided but no termId, open the first term in that category.
  if (category && !termId) {
    // Check if this is actually a term ID at the old /dictionary/:termId URL (backwards compat)
    const directTerm = DICTIONARY_TERMS.find((t) => t.id === category);
    if (directTerm) {
      return <TermPage term={directTerm} />;
    }
    // Check if it's a valid category and default to its first non-library term.
    if (category in CATEGORY_LABELS) {
      const firstInCategory = DICTIONARY_TERMS.find(
        (t) => t.category === category && !t.libraryInternal,
      );
      if (firstInCategory) {
        return <TermPage term={firstInCategory} />;
      }
      return <CategoryPage category={category as DictionaryCategory} />;
    }
    return (
      <NotFound message={`No dictionary category matches "${category}".`} />
    );
  }

  // If both category and termId, show term page
  if (category && termId) {
    const term =
      DICTIONARY_TERMS.find(
        (t) => t.id === termId && t.category === category,
      ) ?? DICTIONARY_TERMS.find((t) => t.id === termId);
    if (term) {
      return <TermPage term={term} />;
    }
    return (
      <NotFound
        message={`The term "${termId}" is not in our dictionary yet.`}
      />
    );
  }

  // Default dictionary landing shows category overview and term index.
  return <DictionaryIndex />;
}

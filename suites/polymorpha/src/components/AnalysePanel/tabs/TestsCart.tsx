import React from "react";
import type { Recommendation as ResultRecommendation } from "@/lib/stats/tests";
import type { CartItem } from "@/store/useDataStore";
import type { TestKey, TestHighlight } from "@/components/AnalysePanel/analyseHelpers";
import type { FormulaCard } from "./testsRunner";

interface SpotlightProps {
  highlights: TestHighlight[];
  emptyText: string;
}

interface FormulaSectionProps {
  formulaCards: FormulaCard[];
}

interface RecommendationsSectionProps {
  recommendations: ResultRecommendation[];
}

interface TestsCartProps {
  cart: CartItem[];
  cartCount: number;
  testHighlights: TestHighlight[];
  formulaCards: FormulaCard[];
  resultRecommendations: ResultRecommendation[];
  removeFromCart: (id: string) => void;
  setSelectedTests: React.Dispatch<
    React.SetStateAction<Record<TestKey, boolean>>
  >;
}

interface TestsCartMobileProps {
  cartOpen: boolean;
  setCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cart: CartItem[];
  cartCount: number;
  testHighlights: TestHighlight[];
  removeFromCart: (id: string) => void;
  setSelectedTests: React.Dispatch<
    React.SetStateAction<Record<TestKey, boolean>>
  >;
  runAllSelectedTests: () => void;
  selectedTestCount: number;
}

interface TestsCartItemProps {
  item: CartItem;
  highlight?: TestHighlight;
  formula?: FormulaCard;
  onRemove: () => void;
}

export function ResultsSpotlight({ highlights, emptyText }: SpotlightProps) {
  return (
    <section className="tests-spotlight">
      <div className="tests-spotlight-head">
        <h3>Results Spotlight</h3>
        <span className="tests-spotlight-count">
          {highlights.length} highlighted
        </span>
      </div>
      {highlights.length === 0 ? (
        <p className="clean-hint-line">{emptyText}</p>
      ) : (
        <div className="tests-spotlight-grid">
          {highlights.map((item, index) => (
            <article
              key={`${item.name}-${index}`}
              className={`tests-spotlight-item tests-spotlight-item--${item.tone}`}
            >
              <p className="tests-spotlight-name">{item.name}</p>
              <p className="tests-spotlight-metric">{item.metric}</p>
              <p className="tests-spotlight-detail">{item.detail}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function FormulasSection({ formulaCards }: FormulaSectionProps) {
  return (
    <section className="tests-formula-section">
      <div className="tests-spotlight-head">
        <h3>Formulas &amp; Data</h3>
      </div>
      {formulaCards.map((fc, i) => (
        <div key={`formula-${i}`} className="formula-card">
          <p className="formula-card-name">{fc.name}</p>
          <p className="formula-card-expr">{fc.formula}</p>
          <p className="formula-card-sub">{fc.substituted}</p>
          <p className="formula-card-result">{fc.result}</p>
        </div>
      ))}
    </section>
  );
}

export function RecommendationsSection({
  recommendations,
}: RecommendationsSectionProps) {
  return (
    <section className="tests-recommendations">
      <div className="tests-spotlight-head">
        <h3>Recommendations</h3>
        <span className="tests-spotlight-count">{recommendations.length}</span>
      </div>
      {recommendations.map((rec, i) => (
        <article
          key={`rec-${i}`}
          className={`tests-rec-card tests-rec-card--${rec.tone}`}
        >
          <p className="tests-rec-title">{rec.title}</p>
          <p className="tests-rec-body">{rec.body}</p>
        </article>
      ))}
    </section>
  );
}

function TestsCartItem({
  item,
  highlight,
  formula,
  onRemove,
}: TestsCartItemProps) {
  return (
    <li className="tests-cart-item tests-cart-item--expanded">
      <div className="tests-cart-item-header">
        <span className="tests-cart-item-type">{item.type}</span>
        <span className="tests-cart-item-name">{item.label}</span>
        <button
          className="tests-cart-item-remove"
          title="Remove"
          onClick={onRemove}
        >
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {highlight && (
        <div className="tests-cart-item-detail">
          <span
            className={`tests-cart-item-metric tests-cart-item-metric--${highlight.tone}`}
          >
            {highlight.metric}
          </span>
          <span className="tests-cart-item-info">{highlight.detail}</span>
        </div>
      )}
      {formula && (
        <p className="tests-cart-item-formula">{formula.substituted}</p>
      )}
    </li>
  );
}

function findHighlight(
  item: CartItem,
  testHighlights: TestHighlight[],
): TestHighlight | undefined {
  if (item.type !== "test") return undefined;
  return testHighlights.find(
    (h) =>
      h.name.toLowerCase().includes(item.label.toLowerCase()) ||
      item.label.toLowerCase().includes(h.name.toLowerCase()),
  );
}

function findFormula(
  item: CartItem,
  formulaCards: FormulaCard[],
): FormulaCard | undefined {
  if (item.type !== "test") return undefined;
  return formulaCards.find(
    (fc) =>
      fc.name.toLowerCase().includes(item.label.toLowerCase()) ||
      item.label.toLowerCase().includes(fc.name.toLowerCase()),
  );
}

export function TestsCart({
  cart,
  cartCount,
  testHighlights,
  formulaCards,
  resultRecommendations,
  removeFromCart,
  setSelectedTests,
}: TestsCartProps) {
  return (
    <aside className="tests-cart">
      <div className="tests-cart-head">
        <h3>Selection</h3>
        <span className="tests-cart-count">{cartCount}</span>
      </div>
      {cartCount === 0 ? (
        <p className="clean-hint-line">
          Add tests or visuals to your selection.
        </p>
      ) : (
        <ul className="tests-cart-list">
          {cart.map((item) => (
            <TestsCartItem
              key={item.id}
              item={item}
              highlight={findHighlight(item, testHighlights)}
              formula={findFormula(item, formulaCards)}
              onRemove={() => {
                removeFromCart(item.id);
                if (item.type === "test") {
                  const tk = item.id.replace("test-", "") as TestKey;
                  setSelectedTests((prev) => ({
                    ...prev,
                    [tk]: false,
                  }));
                }
              }}
            />
          ))}
        </ul>
      )}
      <ResultsSpotlight
        highlights={testHighlights}
        emptyText="Run selected tests to generate a clean, highlighted summary here."
      />
      {formulaCards.length > 0 && (
        <FormulasSection formulaCards={formulaCards} />
      )}
      {resultRecommendations.length > 0 && (
        <RecommendationsSection recommendations={resultRecommendations} />
      )}
    </aside>
  );
}

export function TestsCartMobile({
  cartOpen,
  setCartOpen,
  cart,
  cartCount,
  testHighlights,
  removeFromCart,
  setSelectedTests,
  runAllSelectedTests,
  selectedTestCount,
}: TestsCartMobileProps) {
  return (
    <>
      <button
        className="tests-cart-fab"
        onClick={() => setCartOpen((o) => !o)}
        aria-label="Open selection"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {cartCount > 0 && (
          <span className="tests-cart-fab-badge">{cartCount}</span>
        )}
      </button>
      {cartOpen && (
        <div
          className="tests-cart-mobile-overlay"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="tests-cart-mobile"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tests-cart-head">
              <h3>Selection</h3>
              <span className="tests-cart-count">{cartCount}</span>
              <button
                className="tests-cart-mobile-close"
                onClick={() => setCartOpen(false)}
                aria-label="Close selection"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            {cartCount === 0 ? (
              <p className="clean-hint-line">
                Add tests or visuals to your selection.
              </p>
            ) : (
              <>
                <ul className="tests-cart-list">
                  {cart.map((item) => (
                    <TestsCartItem
                      key={item.id}
                      item={item}
                      highlight={findHighlight(item, testHighlights)}
                      onRemove={() => {
                        removeFromCart(item.id);
                        if (item.type === "test") {
                          const tk = item.id.replace("test-", "") as TestKey;
                          setSelectedTests((prev) => ({
                            ...prev,
                            [tk]: false,
                          }));
                        }
                      }}
                    />
                  ))}
                </ul>
                <button
                  className="btn-primary btn-sm tests-cart-mobile-run"
                  onClick={() => {
                    runAllSelectedTests();
                    setCartOpen(false);
                  }}
                >
                  Run All ({selectedTestCount})
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

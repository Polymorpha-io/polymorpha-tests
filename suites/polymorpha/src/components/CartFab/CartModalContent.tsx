import React from "react";
import { Plot } from "@/components/Charts/LazyPlot";
import { useDataStore } from "@/store/useDataStore";
import type { CartItem } from "@/store/useDataStore";

const PLOT_FONT_COLOR = "#1f2937";

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmt(value: unknown, digits = 4): string {
  const n = asFinite(value);
  return n === null ? "N/A" : n.toFixed(digits);
}

class CartPreviewBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="clean-hint-line">
          Preview failed to render for this cart item.
        </p>
      );
    }
    return this.props.children;
  }
}

function normalizeTestKey(item: CartItem): string {
  const metaKey =
    typeof item.meta?.testKey === "string" ? item.meta.testKey : "";
  if (metaKey) return metaKey;
  return item.id.startsWith("test-") ? item.id.replace("test-", "") : "";
}

function TestResultPreview({ item }: { item: CartItem }) {
  const results = useDataStore((s) => s.results);
  const cleaned = useDataStore((s) => s.cleaned);
  const testKey = normalizeTestKey(item);

  if (!results)
    return <p className="clean-hint-line">No analysis results yet.</p>;

  if (testKey === "tTest") {
    const r = results.tTests?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          t = {fmt(r.t)} · p = {fmt(r.pValue)} · df = {fmt(r.df, 2)}
        </p>
        {cleaned &&
          r.column1 &&
          r.column2 &&
          (() => {
            const x1 = cleaned.rows
              .map((row) => Number(row[r.column1]))
              .filter((v) => !isNaN(v));
            const x2 = cleaned.rows
              .map((row) => Number(row[r.column2!]))
              .filter((v) => !isNaN(v));
            return (
              <Plot
                data={[
                  { y: x1, type: "box", name: r.column1 },
                  { y: x2, type: "box", name: r.column2 },
                ]}
                layout={{
                  margin: { t: 10, b: 30, l: 40, r: 10 },
                  height: 220,
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  font: { color: PLOT_FONT_COLOR, size: 10 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", maxWidth: "400px" }}
              />
            );
          })()}
      </div>
    );
  }
  if (testKey === "anova") {
    const r = results.anova?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          F = {fmt(r.F)} · p = {fmt(r.pValue)} · eta² = {fmt(r.etaSquared)}
        </p>
        {cleaned &&
          r.factor &&
          r.responseVar &&
          (() => {
            const groups = [
              ...new Set(
                cleaned.rows
                  .map((row) => String(row[r.factor] ?? ""))
                  .filter(Boolean),
              ),
            ];
            const traces = groups.map((g) => ({
              y: cleaned.rows
                .filter((row) => String(row[r.factor]) === g)
                .map((row) => Number(row[r.responseVar]))
                .filter((v) => !isNaN(v)),
              type: "box" as const,
              name: g,
            }));
            return (
              <Plot
                data={traces}
                layout={{
                  margin: { t: 10, b: 30, l: 40, r: 10 },
                  height: 220,
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  font: { color: PLOT_FONT_COLOR, size: 10 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", maxWidth: "400px" }}
              />
            );
          })()}
      </div>
    );
  }
  if (testKey === "regression") {
    const r = results.regression?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          R² = {fmt(r.rSquared)} · adj R² = {fmt(r.adjRSquared)} · F p ={" "}
          {fmt(r.fPValue)}
        </p>
        {cleaned &&
          r.predictors?.length > 0 &&
          r.dependentVar &&
          (() => {
            const pred = r.predictors[0];
            const x: number[] = [];
            const y: number[] = [];
            cleaned.rows.forEach((row) => {
              const a = Number(row[pred]);
              const b = Number(row[r.dependentVar]);
              if (!isNaN(a) && !isNaN(b)) {
                x.push(a);
                y.push(b);
              }
            });
            if (x.length === 0) return null;
            return (
              <Plot
                data={[
                  {
                    x,
                    y,
                    type: "scatter",
                    mode: "markers",
                    marker: { size: 5, opacity: 0.7, color: "#1d4ed8" },
                  },
                ]}
                layout={{
                  xaxis: { title: pred },
                  yaxis: { title: r.dependentVar },
                  margin: { t: 10, b: 34, l: 44, r: 10 },
                  height: 220,
                  paper_bgcolor: "transparent",
                  plot_bgcolor: "transparent",
                  font: { color: PLOT_FONT_COLOR, size: 10 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%", maxWidth: "400px" }}
              />
            );
          })()}
      </div>
    );
  }
  if (testKey === "mannWhitney") {
    const r = results.mannWhitney?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          U = {fmt(r.U)} · p = {fmt(r.pValue)} · {String(r.group1 ?? "Group 1")}{" "}
          vs {String(r.group2 ?? "Group 2")}
        </p>
      </div>
    );
  }
  if (testKey === "kruskal") {
    const r = results.kruskalWallis?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          H = {fmt(r.H)} · p = {fmt(r.pValue)} · df = {fmt(r.df, 2)}
        </p>
      </div>
    );
  }
  if (testKey === "chiSquare") {
    const r = results.chiSquare?.[0];
    if (!r)
      return (
        <p className="clean-hint-line">Run this test to see result details.</p>
      );
    return (
      <div className="cart-preview-test-viz">
        <p className="cart-preview-summary">
          chi² = {fmt(r.chiSq)} · p = {fmt(r.pValue)} · Cramer's V ={" "}
          {fmt(r.cramersV)}
        </p>
      </div>
    );
  }

  if (testKey === "correlation") {
    if (!results.correlation)
      return (
        <p className="clean-hint-line">
          Correlation matrix is not available yet.
        </p>
      );
    const cols = results.correlation.columns;
    let bestI = -1;
    let bestJ = -1;
    let best = -1;
    const matrix = Array.isArray(results.correlation.values)
      ? results.correlation.values
      : [];
    for (let i = 0; i < matrix.length; i++) {
      const row = Array.isArray(matrix[i]) ? matrix[i] : [];
      for (let j = i + 1; j < row.length; j++) {
        const v = row[j];
        if (!isNaN(v) && Math.abs(v) > best) {
          best = Math.abs(v);
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0 || bestJ < 0 || !cols[bestI] || !cols[bestJ])
      return (
        <p className="clean-hint-line">No valid correlation pairs found.</p>
      );
    return (
      <p className="cart-preview-summary">
        Strongest pair: {cols[bestI]} vs {cols[bestJ]} · r ={" "}
        {fmt(matrix[bestI]?.[bestJ])}
      </p>
    );
  }

  return (
    <p className="clean-hint-line">Run this test to see result details.</p>
  );
}

function VisualResultPreview({ item }: { item: CartItem }) {
  const cleaned = useDataStore((s) => s.cleaned);
  if (!cleaned)
    return (
      <p className="clean-hint-line">
        No cleaned dataset available for chart preview.
      </p>
    );

  const visMode =
    typeof item.meta?.visMode === "string" ? item.meta.visMode : "univariate";
  const chartType =
    typeof item.meta?.chartType === "string" ? item.meta.chartType : "bar";
  const colA = typeof item.meta?.colA === "string" ? item.meta.colA : "";
  const colB = typeof item.meta?.colB === "string" ? item.meta.colB : "";

  if (!colA)
    return (
      <p className="clean-hint-line">
        Visual details are unavailable for this cart item.
      </p>
    );

  const colAType = cleaned.columns.find((c) => c.name === colA)?.type;
  const colBType = colB
    ? cleaned.columns.find((c) => c.name === colB)?.type
    : undefined;

  if (visMode === "univariate") {
    if (colAType === "numeric") {
      const x = cleaned.rows
        .map((r) => r[colA])
        .filter((v) => typeof v === "number" && !isNaN(v)) as number[];
      if (x.length === 0)
        return (
          <p className="clean-hint-line">
            No numeric values available to preview this chart.
          </p>
        );
      if (chartType === "box") {
        return (
          <Plot
            data={[{ y: x, type: "box", name: colA }]}
            layout={{
              margin: { t: 20, b: 34, l: 44, r: 12 },
              height: 250,
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: PLOT_FONT_COLOR },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
        );
      }
      return (
        <Plot
          data={[
            {
              x,
              type: "histogram",
              marker: { color: "#1d4ed8", opacity: 0.85 },
            },
          ]}
          layout={{
            xaxis: { title: colA },
            margin: { t: 20, b: 34, l: 44, r: 12 },
            height: 250,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: PLOT_FONT_COLOR },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      );
    }

    const values = cleaned.rows
      .map((r) => String(r[colA] ?? ""))
      .filter(Boolean);
    const counts = new Map<string, number>();
    values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    const labels = [...counts.keys()];
    const y = labels.map((k) => counts.get(k) ?? 0);
    if (labels.length === 0)
      return (
        <p className="clean-hint-line">
          No categorical values available to preview this chart.
        </p>
      );

    if (chartType === "pie") {
      return (
        <Plot
          data={[{ labels, values: y, type: "pie", textinfo: "label+percent" }]}
          layout={{
            margin: { t: 20, b: 20, l: 20, r: 20 },
            height: 250,
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            font: { color: PLOT_FONT_COLOR },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      );
    }
    return (
      <Plot
        data={[{ x: labels, y, type: "bar", marker: { color: "#1d4ed8" } }]}
        layout={{
          xaxis: { title: colA },
          margin: { t: 20, b: 56, l: 44, r: 12 },
          height: 250,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: PLOT_FONT_COLOR },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    );
  }

  if (!colB)
    return (
      <p className="clean-hint-line">
        Second column is missing for this bivariate visual.
      </p>
    );

  if (colAType === "numeric" && colBType === "numeric") {
    const x: number[] = [];
    const y: number[] = [];
    cleaned.rows.forEach((r) => {
      const a = r[colA];
      const b = r[colB];
      if (
        typeof a === "number" &&
        !isNaN(a) &&
        typeof b === "number" &&
        !isNaN(b)
      ) {
        x.push(a);
        y.push(b);
      }
    });
    if (x.length === 0)
      return (
        <p className="clean-hint-line">
          No paired numeric values available for this scatter preview.
        </p>
      );
    return (
      <Plot
        data={[
          {
            x,
            y,
            type: "scatter",
            mode: "markers",
            marker: { size: 6, opacity: 0.75, color: "#1d4ed8" },
          },
        ]}
        layout={{
          xaxis: { title: colA },
          yaxis: { title: colB },
          margin: { t: 20, b: 34, l: 44, r: 12 },
          height: 250,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: PLOT_FONT_COLOR },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    );
  }

  const groupCol = colAType === "categorical" ? colA : colB;
  const numCol = colAType === "numeric" ? colA : colB;
  const groups = [
    ...new Set(
      cleaned.rows.map((r) => String(r[groupCol] ?? "")).filter(Boolean),
    ),
  ];
  const traces = groups
    .map((g) => ({
      y: cleaned.rows
        .filter((r) => String(r[groupCol]) === g)
        .map((r) => Number(r[numCol]))
        .filter((v) => !isNaN(v)),
      type: "box" as const,
      name: g,
    }))
    .filter((trace) => trace.y.length > 0);
  if (traces.length === 0)
    return (
      <p className="clean-hint-line">
        No grouped numeric values available for this chart preview.
      </p>
    );
  return (
    <Plot
      data={traces}
      layout={{
        margin: { t: 20, b: 34, l: 44, r: 12 },
        height: 250,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: PLOT_FONT_COLOR },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
    />
  );
}

export function CartModalContent() {
  const cart = useDataStore((s) => s.cart);
  const removeFromCart = useDataStore((s) => s.removeFromCart);
  const [activeId, setActiveId] = React.useState<string | null>(
    cart[0]?.id ?? null,
  );

  React.useEffect(() => {
    if (cart.length === 0) {
      setActiveId(null);
      return;
    }
    if (!cart.some((item) => item.id === activeId)) {
      setActiveId(cart[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  if (cart.length === 0) {
    return (
      <p className="clean-hint-line">
        No tests or visuals added yet. Run a test or add a chart to see them
        here.
      </p>
    );
  }

  const activeItem = cart.find((item) => item.id === activeId) ?? cart[0];

  return (
    <div className="cart-preview-layout">
      <ul className="cart-preview-list">
        {cart.map((item) => (
          <li key={item.id}>
            <button
              className={`cart-preview-link${item.id === activeItem.id ? " active" : ""}`}
              onClick={() => setActiveId(item.id)}
            >
              <span className="cart-preview-type">{item.type}</span>
              <span className="cart-preview-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-preview-main">
        <div className="cart-preview-main-head">
          <h4>{activeItem.label}</h4>
          <button
            className="global-cart-item-remove"
            title="Remove"
            onClick={() => removeFromCart(activeItem.id)}
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

        <div className="cart-preview-body">
          <CartPreviewBoundary key={activeItem.id}>
            {activeItem.type === "test" ? (
              <TestResultPreview item={activeItem} />
            ) : null}
            {activeItem.type === "visual" ? (
              <VisualResultPreview item={activeItem} />
            ) : null}
          </CartPreviewBoundary>
          {activeItem.type === "method" ? (
            <p className="clean-hint-line">
              Method items can be managed from cart list.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

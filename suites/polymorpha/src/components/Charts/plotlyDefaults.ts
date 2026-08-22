import type { Layout } from "plotly.js";

/**
 * Shared Plotly layout defaults that match Polymorpha design tokens.
 * Uses CSS custom-property values resolved at call time.
 */
export function baseLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  const isMobile = window.innerWidth <= 760;

  // We read the actual computed styles to get rgb() values that Plotly perfectly understands,
  // even if the underlying CSS uses modern oklch().
  const bodyStyle = getComputedStyle(document.body);
  const surface = bodyStyle.backgroundColor || "#ffffff";
  const text = bodyStyle.color || "#000000";

  // For border and muted colors, we create a temporary element to let the browser resolve the oklch to rgb
  const tempEl = document.createElement("div");
  tempEl.className = "border-border text-muted-foreground";
  document.body.appendChild(tempEl);
  const tempStyle = getComputedStyle(tempEl);
  const border = tempStyle.borderColor || "#e2e8f0";
  const textDim = tempStyle.color || "#64748b";
  document.body.removeChild(tempEl);

  return {
    paper_bgcolor: "transparent",
    plot_bgcolor: surface,
    font: {
      family: "Outfit, system-ui, sans-serif",
      size: isMobile ? 10 : 13,
      color: text,
    },
    margin: isMobile
      ? { t: 16, r: 12, b: 36, l: 38 }
      : { t: 32, r: 24, b: 48, l: 56 },
    xaxis: {
      gridcolor: border,
      linecolor: border,
      zerolinecolor: border,
      tickfont: { size: isMobile ? 9 : 11, color: textDim },
      ...((overrides.xaxis as object) ?? {}),
    },
    yaxis: {
      gridcolor: border,
      linecolor: border,
      zerolinecolor: border,
      tickfont: { size: isMobile ? 9 : 11, color: textDim },
      ...((overrides.yaxis as object) ?? {}),
    },
    hoverlabel: {
      bgcolor: surface,
      bordercolor: border,
      font: { family: "Outfit, system-ui, sans-serif", size: 12, color: text },
    },
    ...overrides,
    // Re-apply axes after spread so overrides aren't clobbered
  };
}

/** Shared config that hides the Plotly logo and enables responsive mode. */
export const plotlyConfig: Partial<Plotly.Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
};

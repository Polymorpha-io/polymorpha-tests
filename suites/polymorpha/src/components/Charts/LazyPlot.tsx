import React from "react";

type UnknownRecord = Record<string, unknown>;

// Lazy Plot — code-splits plotly.js (~3.5 MB) out of initial chunk (06)
export const Plot = React.lazy(
  () => import("react-plotly.js"),
) as unknown as React.ComponentType<UnknownRecord>;

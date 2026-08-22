import React from "react";
import { checkRenderSafety } from "./renderSafety";
import type { Dataset } from "@/types";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface RenderSafeChartProps {
  dataset: Dataset;
  chartType: string;
  mapping: Record<string, string>;
  children: React.ReactNode;
}

export function RenderSafeChart({
  dataset,
  chartType,
  mapping,
  children,
}: RenderSafeChartProps) {
  const safety = React.useMemo(
    () => checkRenderSafety(chartType, dataset, mapping),
    [chartType, dataset, mapping]
  );

  if (!safety.isSafe) {
    return (
      <div className="alert alert-error" style={{ margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <ShieldAlert size={20} color="var(--error)" />
          <strong>Render Blocked</strong>
        </div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {safety.blocks.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      {safety.warnings.length > 0 && (
        <div className="alert alert-warning" style={{ margin: "16px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <strong>Render Warning</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {safety.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </>
  );
}

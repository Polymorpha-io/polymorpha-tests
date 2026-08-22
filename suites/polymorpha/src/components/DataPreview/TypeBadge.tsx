import type { Column } from "@/types";
import { TYPE_COLOR } from "./dataModellerUtils";

export function TypeBadge({ col }: { col: Column }) {
  return (
    <span
      className="type-badge"
      style={{ backgroundColor: TYPE_COLOR[col.type] ?? "#64748b" }}
    >
      {col.type}
    </span>
  );
}

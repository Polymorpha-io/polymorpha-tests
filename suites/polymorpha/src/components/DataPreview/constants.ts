import { Hash, Tag, Calendar, ToggleLeft, HelpCircle } from "lucide-react";
import { Columns } from "@/constants/schema";

export const PREVIEW_LIMIT = 100;

export const ValidCols = new Set(Object.values(Columns));

export const ColumnsIcon = {
  [Columns.Numeric]: Hash,
  [Columns.Categorical]: Tag,
  [Columns.Date]: Calendar,
  [Columns.Boolean]: ToggleLeft,
  [Columns.Unknown]: HelpCircle,
} as const;

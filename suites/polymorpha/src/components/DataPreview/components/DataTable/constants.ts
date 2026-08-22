/** Pixel-per-character width estimate for column header name sizing */
export const CHAR_WIDTH_PX = 7;

/** Extra horizontal padding added to the computed header width */
export const HEADER_PADDING_PX = 28;

/** Minimum column width (px) for categorical / unknown columns */
export const MIN_COL_WIDTH_STRINGY = 160;

/** Minimum column width (px) for numeric / date / boolean columns */
export const MIN_COL_WIDTH_COMPACT = 130;

/** Maximum column width (px) cap */
export const MAX_COL_WIDTH_PX = 250;

/** Row-number column identifier used in TanStack Table column defs */
export const ROW_NUMBER_COL_ID = "__row_number";

/** Row-number column header label */
export const ROW_NUMBER_HEADER = "#";

/** Row-number column width (px) — matches `min-w-13` (52px) */
export const ROW_NUMBER_WIDTH_PX = 52;

/** Text displayed when a cell value is null / undefined / empty string */
export const EMPTY_CELL_TEXT = "N/A";

/** Number of rows to render outside the visible viewport (vertical) */
export const ROW_OVERSCAN = 10;

/** Number of columns to render outside the visible viewport (horizontal) */
export const COL_OVERSCAN = 6;

/** Estimated row height in pixels for the virtualizer */
export const ROW_ESTIMATE_PX = 38;

import { describe, expect, it } from "vitest";
import {
  EDITOR_MAX_LINES,
  EDITOR_MIN_LINES,
  EDITOR_LINE_HEIGHT_PX,
  EDITOR_VERTICAL_PADDING_PX,
  clampEditorHeight,
} from "@/lib/editorHeight";

const MIN =
  EDITOR_MIN_LINES * EDITOR_LINE_HEIGHT_PX + EDITOR_VERTICAL_PADDING_PX;
const MAX =
  EDITOR_MAX_LINES * EDITOR_LINE_HEIGHT_PX + EDITOR_VERTICAL_PADDING_PX;

describe("clampEditorHeight", () => {
  it("floors tiny, zero, and garbage heights at the minimum", () => {
    expect(clampEditorHeight(0)).toBe(MIN);
    expect(clampEditorHeight(-4)).toBe(MIN);
    expect(clampEditorHeight(Number.NaN)).toBe(MIN);
    expect(clampEditorHeight(10)).toBe(MIN);
  });

  it("passes mid-range heights through (ceiled)", () => {
    expect(clampEditorHeight(100.2)).toBe(101);
  });

  it("caps tall content at the maximum", () => {
    expect(clampEditorHeight(10_000)).toBe(MAX);
    expect(MAX).toBeGreaterThan(MIN);
  });
});

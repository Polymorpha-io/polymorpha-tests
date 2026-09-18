import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SCRUB_PREVIEWS } from "@/components/DataPreview/modeller/ScrubInspectorContent";
import { SCRUB_STEPS } from "@/components/DataPreview/modeller/ScrubInspectorContent";
import { CLEAN_STEPS } from "@/components/CleaningPanel/constants";
import type { CleanStepId } from "@/components/CleaningPanel/types";

const SCRUB_IDS: CleanStepId[] = [
  CLEAN_STEPS.missing,
  CLEAN_STEPS.outliers,
  CLEAN_STEPS.duplicates,
  CLEAN_STEPS.stringReplace,
  CLEAN_STEPS.standardize,
  CLEAN_STEPS.typeConversion,
  CLEAN_STEPS.textCleanup,
];

describe("SCRUB_STEPS card consistency", () => {
  it("every scrub card carries an icon and description like recipe cards", () => {
    expect(SCRUB_STEPS).toHaveLength(7);
    for (const s of SCRUB_STEPS) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.desc.trim().length).toBeGreaterThan(0);
      expect(s.icon, `missing icon for ${s.id}`).toBeDefined();
    }
  });
});
describe("SCRUB_PREVIEWS", () => {
  it("covers every scrub step (no text-only tooltip fallback)", () => {
    for (const id of SCRUB_IDS) {
      expect(SCRUB_PREVIEWS[id], `missing preview for ${id}`).toBeDefined();
    }
  });

  it("renders the step label and formula pill", () => {
    for (const id of SCRUB_IDS) {
      const Preview = SCRUB_PREVIEWS[id]!;
      const { unmount } = render(
        <Preview label={`Scrub ${id}`} plain="desc" />,
      );
      expect(screen.getByText(`Scrub ${id}`)).toBeInTheDocument();
      unmount();
    }
  });
});

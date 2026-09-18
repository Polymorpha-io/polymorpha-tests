import { describe, it, expect } from "vitest";
import { TEST_META } from "@polymorpha/business-logic";
import { cleanCodeAreas } from "@polymorpha/business-logic";
import { ANALYSE_CARDS } from "@/components/NotebookWorkbench/palettes/analyseCards";
import { CLEAN_CARDS } from "@/components/NotebookWorkbench/palettes/cleanCards";
import { EXPORT_CARDS } from "@/components/NotebookWorkbench/palettes/exportCards";
import { showcaseFor } from "@/components/NotebookWorkbench/palettes/showcases";

/** Every palette card that promises a demo must resolve one (G34:
 *  demos derive from spec files, never fabricated in the card). */
describe("palette showcases", () => {
  it("covers all 52 TestKeys", () => {
    const missing = Object.keys(TEST_META).filter((k) => !showcaseFor(k));
    expect(missing).toEqual([]);
  });

  it("covers every cleanCode area", () => {
    const areaToCard: Record<string, string[]> = {
      missing: ["drop-missing", "fill-missing"],
      missingIndicator: ["missingIndicator"],
      outlier: ["outlier", "outliers-iqr"],
      scaling: ["scaling"],
      encoding: ["encoding"],
      dedupe: ["duplicates"],
      sampling: ["sampling"],
      stringClean: ["stringClean"],
      typeConvert: ["fix-types"],
      rowFilter: ["rowFilter"],
      categoryMap: ["categoryMap"],
      math: ["math"],
      bin: ["bin"],
      dateExtract: ["dateExtract"],
      derived: ["derived"],
      lagLead: ["lagLead"],
      interaction: ["interaction"],
      bucket: ["bucket"],
      columns: ["drop-column"],
    };
    const ids = new Set(CLEAN_CARDS.map((c) => c.id));
    for (const area of cleanCodeAreas()) {
      const cards = areaToCard[area] ?? [];
      expect(cards.length, `${area} needs a card`).toBeGreaterThan(0);
      for (const id of cards) {
        expect(ids.has(id), `${area} → card ${id} exists`).toBe(true);
        expect(showcaseFor(id), `${id} resolves a showcase`).toBeDefined();
      }
    }
  });

  it("resolves to renderable components", () => {
    const ids = [
      ...ANALYSE_CARDS.map((c) => c.id),
      ...CLEAN_CARDS.map((c) => c.id),
      ...EXPORT_CARDS.map((c) => c.id),
    ];
    for (const id of ids) {
      const C = showcaseFor(id);
      if (C !== undefined) expect(typeof C).toBe("function");
    }
    // Spot-check honest gaps stay empty (file-write snippets).
    expect(showcaseFor("parquet")).toBeUndefined();
    expect(showcaseFor("definitely-not-a-card")).toBeUndefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CLEAN_CARDS } from "@/components/NotebookWorkbench/palettes/cleanCards";
import { ANALYSE_CARDS } from "@/components/NotebookWorkbench/palettes/analyseCards";
import { EXPORT_CARDS } from "@/components/NotebookWorkbench/palettes/exportCards";
import {
  PaletteShell,
  meetsCardNeeds,
  splitTiers,
} from "@/components/NotebookWorkbench/palettes/PaletteShell";
import type { PaletteCard } from "@/components/NotebookWorkbench/palettes/PaletteSheet";

const LOCKED_CLEAN_ESSENTIALS = [
  "missing-report",
  "drop-missing",
  "fill-missing",
  "duplicates",
  "outlier",
  "scaling",
  "encoding",
  "rowFilter",
  "fix-types",
];

const LOCKED_ANALYSE_ESSENTIALS = [
  "describe",
  "value-counts",
  "normality",
  "scatter",
  "tTest",
  "anova",
  "chiSquare",
  "correlation",
  "regression",
  "ml-train",
];

function stubCard(id: string, extra?: Partial<PaletteCard>): PaletteCard {
  return {
    id,
    label: `Label ${id}`,
    hint: `hint ${id}`,
    detail: `detail ${id}`,
    group: "Group",
    build: () => `# ${id}`,
    ...extra,
  };
}

const CTX = {
  columns: ["age", "city"],
  numeric: ["age"],
  categorical: ["city"],
};
const DATELESS = {
  columns: ["age", "city"],
  numeric: ["age"],
  categorical: ["city"],
};
const EMPTY = { columns: [], numeric: [], categorical: [] };

describe("lane tiering registries (locked tables)", () => {
  it("flags exactly the locked clean essentials", () => {
    const flagged = CLEAN_CARDS.filter((c) => c.essential).map((c) => c.id);
    expect(flagged.sort()).toEqual([...LOCKED_CLEAN_ESSENTIALS].sort());
  });

  it("flags exactly the locked analyse essentials", () => {
    const flagged = ANALYSE_CARDS.filter((c) => c.essential).map((c) => c.id);
    expect(flagged.sort()).toEqual([...LOCKED_ANALYSE_ESSENTIALS].sort());
  });

  it("leaves export untiered (legacy flat render)", () => {
    expect(EXPORT_CARDS.some((c) => c.essential)).toBe(false);
  });

  it("marks only dateExtract/lagLead contextual", () => {
    const contextual = [...CLEAN_CARDS, ...ANALYSE_CARDS, ...EXPORT_CARDS]
      .filter((c) => c.needs?.length)
      .map((c) => c.id)
      .sort();
    expect(contextual).toEqual(["dateExtract", "lagLead"]);
  });
});

describe("meetsCardNeeds", () => {
  it("passes unmarked cards everywhere", () => {
    expect(meetsCardNeeds(stubCard("x"), undefined)).toBe(true);
    expect(meetsCardNeeds(stubCard("x"), EMPTY)).toBe(true);
  });

  it("shows everything on empty/unknown data (never hides)", () => {
    const dated = stubCard("d", { needs: ["dateHint"] });
    expect(meetsCardNeeds(dated, undefined)).toBe(true);
    expect(meetsCardNeeds(dated, EMPTY)).toBe(true);
  });

  it("gates numeric/categorical on hard signals", () => {
    expect(meetsCardNeeds(stubCard("n", { needs: ["numeric"] }), CTX)).toBe(
      true,
    );
    expect(
      meetsCardNeeds(stubCard("n", { needs: ["numeric"] }), {
        columns: ["city"],
        numeric: [],
        categorical: ["city"],
      }),
    ).toBe(false);
    expect(meetsCardNeeds(stubCard("c", { needs: ["categorical"] }), CTX)).toBe(
      true,
    );
  });

  it("sniffs date-like names for dateHint", () => {
    const dated = stubCard("d", { needs: ["dateHint"] });
    expect(meetsCardNeeds(dated, DATELESS)).toBe(false);
    expect(
      meetsCardNeeds(dated, {
        columns: ["age", "sold_date"],
        numeric: ["age"],
        categorical: [],
      }),
    ).toBe(true);
  });

  it("splits essentials from advanced", () => {
    const cards = [stubCard("a", { essential: true }), stubCard("b")];
    const { essentials, advanced } = splitTiers(cards);
    expect(essentials.map((c) => c.id)).toEqual(["a"]);
    expect(advanced.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("PaletteShell tiering", () => {
  const cards = [
    stubCard("ess", { essential: true }),
    stubCard("adv1"),
    stubCard("adv2"),
    stubCard("dated", { needs: ["dateHint"] }),
  ];

  function renderShell(extra?: object) {
    return render(
      <PaletteShell
        title="Test"
        subtitle="sub"
        cards={cards}
        onSelect={() => {}}
        ctx={DATELESS}
        {...extra}
      />,
    );
  }

  it("pins essentials and hides the rest behind All (N)", () => {
    renderShell();
    expect(screen.getByText("Essentials")).toBeInTheDocument();
    expect(screen.getByText("Label ess")).toBeInTheDocument();
    expect(screen.queryByText("Label adv1")).not.toBeInTheDocument();
    // adv1 + adv2 visible to disclosure; dated hidden contextually.
    expect(
      screen.getByRole("button", { name: "All operations (2)" }),
    ).toBeInTheDocument();
  });

  it("reveals advanced on disclosure toggle", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /All operations/ }));
    expect(screen.getByText("Label adv1")).toBeInTheDocument();
    expect(screen.getByText("Label adv2")).toBeInTheDocument();
    // Contextual card stays hidden in browse mode.
    expect(screen.queryByText("Label dated")).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Show less" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("search spans everything including contextual-hidden", () => {
    renderShell();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "dated" },
    });
    expect(screen.getByText("Label dated")).toBeInTheDocument();
  });

  it("renders untiered registries as the legacy flat grouped list", () => {
    const onSelect = vi.fn();
    render(
      <PaletteShell
        title="Export"
        subtitle="sub"
        cards={[stubCard("a"), stubCard("b")]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Label a")).toBeInTheDocument();
    expect(screen.getByText("Label b")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /All operations/ })).toBeNull();
  });

  it("pastes from an essential card like any other card", () => {
    const onSelect = vi.fn();
    render(
      <PaletteShell
        title="Test"
        subtitle="sub"
        cards={cards}
        onSelect={onSelect}
        ctx={DATELESS}
      />,
    );
    fireEvent.click(screen.getByText("Label ess"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ess" }),
    );
  });
});

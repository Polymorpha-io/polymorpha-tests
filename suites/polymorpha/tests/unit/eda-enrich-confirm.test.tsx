import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EdaEnrichStep } from "@/components/CleaningPanel/components/EdaEnrichStep";
import { useDataStore } from "@/store/useDataStore";
import type { Column } from "@/types";

const NUMERIC: Column[] = [
  { name: "age", type: "numeric", detectedType: "numeric" },
] as unknown as Column[];

afterEach(() => {
  useDataStore.getState().clearAppliedSteps();
});

describe("EdaEnrichStep confirmation", () => {
  it("shows no confirmation before any quick-add", () => {
    render(<EdaEnrichStep numericColumns={NUMERIC} allColumns={NUMERIC} />);
    expect(
      screen.queryByText(/Inserted into the Data Modeller pipeline/),
    ).not.toBeInTheDocument();
  });

  it("confirms an inserted step and lists its description", () => {
    render(<EdaEnrichStep numericColumns={NUMERIC} allColumns={NUMERIC} />);
    fireEvent.click(screen.getByRole("button", { name: /Rolling/ }));
    expect(
      screen.getByText(/Inserted into the Data Modeller pipeline/),
    ).toBeInTheDocument();
    expect(screen.getByText("Rolling age window 3 mean")).toBeInTheDocument();
    expect(
      useDataStore
        .getState()
        .appliedSteps.some(
          (s) => s.description === "Rolling age window 3 mean",
        ),
    ).toBe(true);
  });

  it("redirect ops navigate instead of confirming", () => {
    let navigated: string | null = null;
    render(
      <EdaEnrichStep
        numericColumns={NUMERIC}
        allColumns={NUMERIC}
        onNavigateStep={(s) => {
          navigated = s;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /New column/ }));
    expect(navigated).toBe("derived");
    expect(
      screen.queryByText(/Inserted into the Data Modeller pipeline/),
    ).not.toBeInTheDocument();
  });
});

/**
 * Render harness for CleaningPanel tests — eliminates the repeated
 * `render → click Processing tab → expand group → waitFor → click step`
 * navigation sequence.
 */
import React from "react";
import { expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CleaningPanel } from "@/components/CleaningPanel/CleaningPanel";
import { stubBrowserApis } from "./mocks";

/** `render(<CleaningPanel />)` with browser-API stubs for ag-grid etc. */
export function renderCleaningPanel() {
  stubBrowserApis();
  return render(React.createElement(CleaningPanel));
}

export interface StepNavOptions {
  /** e.g. "Missing values" — the step label in CLEAN_TREE */
  step: string;
  /** e.g. "Data quality" — group name containing the step */
  group: string;
}

/**
 * Navigate the CleaningPanel to a specific processing step.
 * Assumes the panel is already rendered (use after `renderCleaningPanel`).
 */
export async function goToStep(opts: StepNavOptions): Promise<void> {
  // G20: robust tab query — shadcn TabsTrigger may be role tab or button depending on version
  const tab =
    screen.queryByRole("tab", { name: /Processing/i }) ??
    screen.queryByText(/Processing/i);
  if (!tab) throw new Error("Processing tab not found");
  fireEvent.click(tab);
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(opts.group, "i") }),
  );
  await waitFor(() => {
    expect(screen.getByText(opts.step)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText(opts.step));
  await waitFor(() => {
    expect(
      screen.getByRole("heading", {
        name: new RegExp(opts.step, "i"),
        level: 3,
      }),
    ).toBeInTheDocument();
  });
}

/** One-shot: render the panel and navigate to a step. */
export async function renderCleaningPanelAtStep(opts: StepNavOptions) {
  renderCleaningPanel();
  await goToStep(opts);
  return screen;
}

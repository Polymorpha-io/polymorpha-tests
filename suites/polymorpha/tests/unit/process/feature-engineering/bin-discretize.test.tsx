import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CleaningPanel } from "@/components/CleaningPanel/CleaningPanel";
import { useDataStore } from "@/store/useDataStore";
import { buildDefaultConfig } from "@polymorpha/business-logic";
import { fixtures } from "@mocks/helpers";

vi.mock("plotly.js", () => ({ default: {} }));
vi.mock("react-plotly.js", () => ({ default: () => <div>Plotly</div> }));
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ result: { column: "col", mean: 0, std: 0 } }),
    text: () => Promise.resolve(JSON.stringify({ result: { column: "col", mean: 0, std: 0 } })),
  } as unknown as Response)
);

describe("Feature Engineering - Bin / Discretize", () => {
  beforeEach(() => {
    useDataStore.setState({
      raw: fixtures.mixed,
      cleaningConfig: buildDefaultConfig(fixtures.mixed),
      step: "clean",
    });
  });

  it("adds and configures a bin rule", async () => {
    render(<CleaningPanel />);

    // Switch to Processing tab, expand Feature engineering group
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Bin / discretize')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Bin / discretize"));

    // Add bin rule
    fireEvent.click(screen.getByText("+ Add bin rule"));

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.binRules).toHaveLength(1);
    expect(config?.binRules[0].column).toBe("age"); // Default first numeric column

    // Find the number input for bins
    const binsInput = screen.getByDisplayValue("5");
    fireEvent.change(binsInput, { target: { value: "3" } });

    const updatedConfig = useDataStore.getState().cleaningConfig;
    expect(updatedConfig?.binRules[0].bins).toBe(3);
    
    // Change column
    const columnSelect = screen.getByRole("combobox", { name: /column/i });
    fireEvent.change(columnSelect, { target: { value: "score" } });
    
    expect(useDataStore.getState().cleaningConfig?.binRules[0].column).toBe("score");
  });

  it("removes a bin rule", async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Bin / discretize')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Bin / discretize"));
    fireEvent.click(screen.getByText("+ Add bin rule"));
    
    expect(useDataStore.getState().cleaningConfig?.binRules).toHaveLength(1);
    
    const removeBtns = screen.getAllByRole("button", { name: "" }); // class clean-remove-btn
    // We should find the specific remove button, but let's see how many there are.
    // In our test, there should be only one remove button in the panel if we only added one rule
    const removeBtn = removeBtns[removeBtns.length - 1]; // last one
    fireEvent.click(removeBtn);
    
    expect(useDataStore.getState().cleaningConfig?.binRules).toHaveLength(0);
  });
});

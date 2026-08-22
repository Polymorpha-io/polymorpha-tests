import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
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

describe("Feature Engineering - Derived Columns", () => {
  const mockDataset = fixtures.minimal;

  beforeEach(() => {
    useDataStore.setState({
      raw: mockDataset,
      cleaningConfig: buildDefaultConfig(mockDataset),
      step: "clean",
    });
  });

  it("adds and configures a derived column rule", async () => {
    render(<CleaningPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Derived columns')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Derived columns"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add derived column"));
    });

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.derivedColumns).toHaveLength(1);
    expect(config?.derivedColumns[0].name).toBe("");
    expect(config?.derivedColumns[0].expression).toBe("");

    // Find the inputs
    const nameInput = screen.getAllByRole("textbox")[0];
    act(() => {
      fireEvent.change(nameInput, { target: { value: "ratio" } });
    });

    // The expression input
    const exprInput = screen.getByPlaceholderText("e.g. col_a / col_b");
    act(() => {
      fireEvent.change(exprInput, { target: { value: "x / y" } });
    });

    const updatedConfig = useDataStore.getState().cleaningConfig;
    expect(updatedConfig?.derivedColumns[0].name).toBe("ratio");
    expect(updatedConfig?.derivedColumns[0].expression).toBe("x / y");
  });

  it("removes a derived column rule", async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Derived columns')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Derived columns"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add derived column"));
    });
    
    expect(useDataStore.getState().cleaningConfig?.derivedColumns).toHaveLength(1);
    
    const removeBtns = screen.getAllByRole("button", { name: "" }); // class clean-remove-btn
    const removeBtn = removeBtns[removeBtns.length - 1];
    
    act(() => {
      fireEvent.click(removeBtn);
    });
    
    expect(useDataStore.getState().cleaningConfig?.derivedColumns).toHaveLength(0);
  });
});

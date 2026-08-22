import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { CleaningPanel } from "@/components/CleaningPanel/CleaningPanel";
import { useDataStore } from "@/store/useDataStore";
import { buildDefaultConfig } from "@polymorpha/business-logic";
import { fixtures } from "@mocks/helpers";

vi.mock("plotly.js", () => ({ default: {} }));
vi.mock("react-plotly.js", () => ({ default: () => <div>Plotly</div> }));
vi.mock("@/lib/stats/descriptive", () => ({
  computeDescriptive: vi.fn(() => Promise.resolve([])),
  computeFrequency: vi.fn(() => Promise.resolve([])),
}));

describe("Feature Engineering - Interaction Terms", () => {
  const mockDataset = fixtures.correlation;

  beforeEach(() => {
    useDataStore.setState({
      raw: mockDataset,
      cleaningConfig: buildDefaultConfig(mockDataset),
      step: "clean",
    });
  });

  it("adds and configures an interaction term rule", async () => {
    render(<CleaningPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Interaction terms')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Interaction terms"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add interaction"));
    });

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.interactionTerms).toHaveLength(1);
    expect(config?.interactionTerms[0].columnA).toBe("height");
    expect(config?.interactionTerms[0].columnB).toBe("weight");
    expect(config?.interactionTerms[0].operation).toBe("multiply");

    // Change operator
    const selects = screen.getAllByRole("combobox");
    const opSelect = selects[1]; // typically second select is operator or we can just find by value "multiply"
    act(() => {
      fireEvent.change(opSelect, { target: { value: "divide" } });
    });

    const updatedConfig = useDataStore.getState().cleaningConfig;
    expect(updatedConfig?.interactionTerms[0].operation).toBe("divide");
  });

  it("removes an interaction term rule", async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Interaction terms')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Interaction terms"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add interaction"));
    });
    
    expect(useDataStore.getState().cleaningConfig?.interactionTerms).toHaveLength(1);
    
    const removeBtns = screen.getAllByRole("button", { name: "" }); // class clean-remove-btn
    const removeBtn = removeBtns[removeBtns.length - 1];
    
    act(() => {
      fireEvent.click(removeBtn);
    });
    
    expect(useDataStore.getState().cleaningConfig?.interactionTerms).toHaveLength(0);
  });
});

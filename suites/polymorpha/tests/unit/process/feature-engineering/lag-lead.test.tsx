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

describe("Feature Engineering - Lag / Lead", () => {
  const mockDataset = fixtures.skewed;

  beforeEach(() => {
    useDataStore.setState({
      raw: mockDataset,
      cleaningConfig: buildDefaultConfig(mockDataset),
      step: "clean",
    });
  });

  it("adds and configures a lag/lead rule", async () => {
    render(<CleaningPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Lag / lead')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Lag / lead"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add lag/lead"));
    });

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.lagLeadRules).toHaveLength(1);
    expect(config?.lagLeadRules[0].column).toBe("income");
    expect(config?.lagLeadRules[0].offset).toBe(1);

    // Change offset
    const offsetInput = screen.getByRole("spinbutton");
    act(() => {
      fireEvent.change(offsetInput, { target: { value: "-1" } });
    });

    const updatedConfig = useDataStore.getState().cleaningConfig;
    expect(updatedConfig?.lagLeadRules[0].offset).toBe(-1);
  });

  it("removes a lag/lead rule", async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Lag / lead')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Lag / lead"));
    
    act(() => {
      fireEvent.click(screen.getByText("+ Add lag/lead"));
    });
    
    expect(useDataStore.getState().cleaningConfig?.lagLeadRules).toHaveLength(1);
    
    const removeBtns = screen.getAllByRole("button", { name: "" }); // class clean-remove-btn
    const removeBtn = removeBtns[removeBtns.length - 1];
    
    act(() => {
      fireEvent.click(removeBtn);
    });
    
    expect(useDataStore.getState().cleaningConfig?.lagLeadRules).toHaveLength(0);
  });
});

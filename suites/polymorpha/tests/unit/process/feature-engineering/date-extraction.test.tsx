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

describe("Feature Engineering - Date Extraction", () => {
  const mockDataset = fixtures.dates_and_text;

  beforeEach(() => {
    useDataStore.setState({
      raw: mockDataset,
      cleaningConfig: buildDefaultConfig(mockDataset),
      step: "clean",
    });
  });

  it("adds and configures a date extraction rule", async () => {
    render(<CleaningPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Date extraction')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Date extraction"));
    fireEvent.click(screen.getByText("+ Add extraction"));

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.dateExtraction).toHaveLength(1);
    expect(config?.dateExtraction[0].column).toBe("joined");
    expect(config?.dateExtraction[0].parts).toEqual(["year", "month"]);

    // Change column
    const columnSelect = screen.getByRole("combobox");
    fireEvent.change(columnSelect, { target: { value: "joined" } });
    expect(useDataStore.getState().cleaningConfig?.dateExtraction[0].column).toBe("joined");

    // Toggle a part
    const yearCheckbox = screen.getByLabelText("year");
    fireEvent.click(yearCheckbox); // uncheck year
    
    expect(useDataStore.getState().cleaningConfig?.dateExtraction[0].parts).not.toContain("year");
  });

  it("removes a date extraction rule", async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Feature engineering/i }));
    await waitFor(() => { expect(screen.getByText('Date extraction')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText("Date extraction"));
    fireEvent.click(screen.getByText("+ Add extraction"));
    
    expect(useDataStore.getState().cleaningConfig?.dateExtraction).toHaveLength(1);
    
    const removeBtns = screen.getAllByRole("button", { name: "" }); // class clean-remove-btn
    const removeBtn = removeBtns[removeBtns.length - 1];
    fireEvent.click(removeBtn);
    
    expect(useDataStore.getState().cleaningConfig?.dateExtraction).toHaveLength(0);
  });
});

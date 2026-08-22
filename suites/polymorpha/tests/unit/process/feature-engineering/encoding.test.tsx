import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { EncodingModal } from "@/components/EncodingModal/EncodingModal";
import { useDataStore } from "@/store/useDataStore";
import { buildDefaultConfig } from "@polymorpha/business-logic";

vi.mock("plotly.js", () => ({ default: {} }));
vi.mock("react-plotly.js", () => ({ default: () => <div>Plotly</div> }));

describe("Feature Engineering - Encoding", () => {
  const mockDataset = {
    columns: [
      { name: "color", type: "categorical" as const },
      { name: "size", type: "categorical" as const },
    ],
    rows: [
      { color: "red", size: "S" },
      { color: "blue", size: "M" },
    ],
    columnStats: {
      color: { uniqueCount: 2, frequencies: { red: 1, blue: 1 } },
      size: { uniqueCount: 2, frequencies: { S: 1, M: 1 } },
    }
  };

  beforeEach(() => {
    useDataStore.setState({
      raw: mockDataset as any,
      cleaningConfig: buildDefaultConfig(mockDataset as any),
      step: "clean",
    });
  });

  it("renders encoding options for categorical columns", () => {
    render(<EncodingModal inline />);

    expect(screen.getAllByText("color").length).toBeGreaterThan(0);
    expect(screen.getAllByText("size").length).toBeGreaterThan(0);
  });

  it("updates encoding type for a column", () => {
    render(<EncodingModal inline />);

    // the first select is the column selector, the second is the encoding type for that column
    const selects = screen.getAllByRole("combobox");
    const typeSelect = selects[1];
    
    act(() => {
      fireEvent.change(typeSelect, { target: { value: "onehot" } });
    });

    const applyBtn = screen.getByRole("button", { name: /Apply encoding/i });
    act(() => {
      fireEvent.click(applyBtn);
    });

    const config = useDataStore.getState().cleaningConfig;
    expect(config?.encodings["color"].type).toBe("onehot");
  });
});

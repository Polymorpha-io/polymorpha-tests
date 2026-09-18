import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FramePicker } from "@/components/NotebookWorkbench/frames/FramePicker";
import type { FrameOption } from "@/components/NotebookWorkbench/frames/frameRegistry";

function live(name: string, kernel: string): FrameOption {
  return {
    laneName: name,
    kernelName: kernel,
    kind: "live",
    fileName: `${name}.csv`,
    source: "upload",
    rows: 690,
    cols: 14,
    columns: [{ name: "age", type: "numeric" }],
    rowsForMeta: [],
    peekNote: "690 rows",
  };
}

describe("FramePicker", () => {
  it("lists every lane frame with shape + kernel name on divergence", () => {
    render(
      <FramePicker
        options={[live("df", "df"), live("out", "df_ws_out")]}
        value="df_ws_out"
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText(
      "Dataset to apply this functionality to",
    );
    expect(select).toBeDefined();
    const opts = Array.from((select as HTMLSelectElement).options).map(
      (o) => o.text,
    );
    expect(opts).toEqual(["df", "out (df_ws_out)"]);
    screen.getByText(/690 rows × 14 cols/);
    screen.getByText(/runs as df_ws_out/);
  });

  it("disables pointer-only frames with their reason", () => {
    const pointer: FrameOption = {
      ...live("sales_2023", "df_ws_sales_2023"),
      kind: "pointer",
      columns: [],
      disabledReason: "Load first — rows live in the combine session",
    };
    render(
      <FramePicker
        options={[live("df", "df"), pointer]}
        value="df"
        onChange={() => {}}
      />,
    );
    const select = screen.getByLabelText(
      "Dataset to apply this functionality to",
    ) as HTMLSelectElement;
    const disabled = Array.from(select.options).find((o) =>
      o.text.includes("sales_2023"),
    );
    expect(disabled?.disabled).toBe(true);
  });

  it("emits kernel names, not lane labels", () => {
    const onChange = vi.fn();
    render(
      <FramePicker
        options={[live("df", "df"), live("out", "df_ws_out")]}
        value="df"
        onChange={onChange}
      />,
    );
    fireEvent.change(
      screen.getByLabelText("Dataset to apply this functionality to"),
      { target: { value: "df_ws_out" } },
    );
    expect(onChange).toHaveBeenCalledWith("df_ws_out");
  });

  it("shows the upload hint when there are no frames", () => {
    render(<FramePicker options={[]} value="" onChange={() => {}} />);
    screen.getByText(/upload a file to create `df`/);
    expect(
      screen.queryByLabelText("Dataset to apply this functionality to"),
    ).toBeNull();
  });
});

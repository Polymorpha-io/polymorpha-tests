import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatasetOverviewDialog } from "@/components/NotebookWorkbench/DatasetOverviewDialog";
import type { Dataset } from "@/types";
import type { DatasetVariable } from "@/components/NotebookWorkbench/variables";

function dataset(fileName: string, rows: number): Dataset {
  return {
    fileName,
    uploadedAt: new Date(0),
    columns: [
      {
        name: "date",
        type: "unknown" as const,
        detectedType: "unknown" as const,
      },
      {
        name: "price",
        type: "numeric" as const,
        detectedType: "numeric" as const,
      },
    ],
    rows: Array.from({ length: rows }, (_, i) => ({
      date: "2014-05-02",
      price: 300000 + i,
    })),
  };
}

function variable(
  name: string,
  source: DatasetVariable["source"],
  liveDataset: Dataset | null,
): DatasetVariable {
  return {
    name,
    kind: "DataFrame",
    rows: liveDataset?.rows.length ?? null,
    cols: liveDataset?.columns.length ?? null,
    source,
    fileName: liveDataset?.fileName ?? name,
    live: liveDataset !== null,
    liveDataset,
    format: "csv",
  };
}

describe("DatasetOverviewDialog", () => {
  it("renders the same header, toggle, table and pagination design when open", () => {
    const raw = dataset("modified_data.csv", 12);
    const cleaned = dataset("modified_data.csv", 11);
    render(
      <DatasetOverviewDialog
        open
        onOpenChange={() => {}}
        variable={variable("df", "upload", raw)}
        raw={raw}
        cleaned={cleaned}
      />,
    );
    // Same DatasetIdentity design: file name, Before/After toggle, counts.
    expect(screen.getByText("modified_data.csv")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /before or after cleaning/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 cols")).toBeInTheDocument();
    // Same DataTable design: headers, rows, pagination footer.
    expect(screen.getByText("price")).toBeInTheDocument();
    expect(screen.getByText("Rows per page")).toBeInTheDocument();
    expect(screen.getByText(/of 12/)).toBeInTheDocument();
    // No workbench footer inside the popup.
    expect(screen.queryByText("Apply changes")).not.toBeInTheDocument();
    expect(screen.queryByText("Copy Python")).not.toBeInTheDocument();
  });

  it("renders without a toggle for kernel frames", () => {
    const frame = dataset("df2", 5);
    render(
      <DatasetOverviewDialog
        open
        onOpenChange={() => {}}
        variable={variable("df2", "kernel", frame)}
        raw={dataset("modified_data.csv", 12)}
        cleaned={null}
      />,
    );
    expect(screen.getByText("df2")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /before or after cleaning/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("price")).toBeInTheDocument();
  });

  it("renders nothing visible when closed", () => {
    const raw = dataset("modified_data.csv", 12);
    render(
      <DatasetOverviewDialog
        open={false}
        onOpenChange={() => {}}
        variable={variable("df", "upload", raw)}
        raw={raw}
        cleaned={null}
      />,
    );
    expect(screen.queryByText("Rows per page")).not.toBeInTheDocument();
  });
});

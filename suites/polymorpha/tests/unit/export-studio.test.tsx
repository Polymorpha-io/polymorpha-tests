import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ExportStudio } from "@/features/export/components/studio/ExportStudio";
import { useReportStore } from "@/features/export/store/useReportStore";
import { DEFAULT_EXPORT_PREFERENCES } from "@/types";

const CLEANED = {
  columns: [
    { name: "age", type: "numeric", detectedType: "numeric" },
    { name: "sex", type: "categorical", detectedType: "categorical" },
  ],
  rows: [
    { age: 30, sex: "M" },
    { age: 40, sex: "F" },
  ],
  fileName: "demo.csv",
  uploadedAt: new Date(),
};

const RESULTS = {
  descriptive: [],
  frequencies: [],
  correlation: null,
  normality: [],
  tTests: [],
  anova: [],
  regression: [],
  mannWhitney: [],
  kruskalWallis: [],
  chiSquare: [],
};

function renderStudio() {
  return render(
    <ExportStudio
      cleaned={CLEANED as never}
      raw={null}
      results={RESULTS as never}
      cleaningDiff={null}
      datasetName="demo"
      preset="standard"
      preferences={{ ...DEFAULT_EXPORT_PREFERENCES }}
      authorName=""
      location=""
      visualKeys={[]}
      pdfDataUrl={null}
      pdfLoading={false}
      pdfError={null}
      generating={false}
      generationPhase=""
      generationProgress={0}
      onRecompile={() => {}}
      totalRowCount={2}
    />,
  );
}

describe("ExportStudio", () => {
  afterEach(() => {
    cleanup();
    useReportStore.setState({
      markdown: "",
      datasetKey: "",
      dirty: false,
      stale: false,
      layout: "split",
      previewTab: "styled",
    });
  });

  it("seeds an editable markdown draft with locked auto blocks", async () => {
    renderStudio();
    const editor = (await screen.findByLabelText(
      "Report markdown source",
    )) as HTMLTextAreaElement;
    expect(editor.value).toContain("## Descriptive");
    expect(screen.getByText(/Auto blocks/)).toBeInTheDocument();
  });

  it("keeps prose edits and switches layout + preview tabs", async () => {
    renderStudio();
    const editor = (await screen.findByLabelText(
      "Report markdown source",
    )) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: editor.value + "\n\nMy note.\n" } });
    expect(useReportStore.getState().dirty).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "LaTeX" }));
    expect(await screen.findByText(/\\documentclass/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Editor" }));
    expect(screen.queryByLabelText("Report markdown source")).toBeInTheDocument();
  });
});

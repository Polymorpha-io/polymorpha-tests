/**
 * transitions-preview render tests — one-hot pilot: static shell shows the
 * before/after sample, animated variant stages pulse → split → removal.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart2 } from "lucide-react";
import {
  AnimatedDuplicates,
  AnimatedExportCsv,
  AnimatedExportDocx,
  AnimatedExportPdf,
  AnimatedExportXlsx,
  AnimatedFilterRows,
  AnimatedGroupBy,
  AnimatedLogisticRegression,
  AnimatedMissingValues,
  AnimatedOneHot,
  AnimatedOutliers,
  AnimatedRandomForest,
  AnimatedRank,
  AnimatedRemoveColumn,
  AnimatedSampleRows,
  AnimatedSortRows,
  AnimatedTopN,
  AnimatedTTest,
  DUPLICATES_PILLS,
  EXPORT_CSV_PILLS,
  EXPORT_DOCX_PILLS,
  EXPORT_PDF_PILLS,
  EXPORT_XLSX_PILLS,
  FILTER_ROWS_PILLS,
  GROUP_BY_PILLS,
  LOGREG_PILLS,
  LOGREG_SAMPLE,
  MISSING_VALUES_PILLS,
  MISSING_VALUES_SAMPLE,
  ONE_HOT_PILLS,
  ONE_HOT_SAMPLE,
  OP_PREVIEWS,
  OUTLIERS_PILLS,
  OUTLIERS_SAMPLE,
  PreviewTooltip,
  RANDOM_FOREST_PILLS,
  RANDOM_FOREST_SAMPLE,
  RANK_PILLS,
  REMOVE_COLUMN_PILLS,
  REMOVE_COLUMN_SAMPLE,
  SAMPLE_ROWS_PILLS,
  SORT_ROWS_PILLS,
  TOP_N_PILLS,
  T_TEST_PILLS,
  T_TEST_SAMPLE,
} from "@/components/transitions-preview";

describe("PreviewTooltip — one-hot pilot", () => {
  it("renders the getDummies before/after sample with rule (no result line)", () => {
    const spec = OP_PREVIEWS.getDummies;
    expect(spec).toBeDefined();

    render(
      <PreviewTooltip
        icon={<BarChart2 size={14} />}
        label="One-hot"
        typeTag="getDummies"
        plain="One-hot 14→52"
        spec={spec!}
      />,
    );

    // Header
    expect(screen.getByText("One-hot")).toBeInTheDocument();
    expect(screen.queryByText("Example")).not.toBeInTheDocument();
    // Before sample (Paris occurs twice — duplicated value is the point)
    expect(screen.getAllByText("Paris")).toHaveLength(2);
    expect(screen.getByText("London")).toBeInTheDocument();
    // Rule + after sample
    expect(
      screen.getByText("each category → its own 1/0 column"),
    ).toBeInTheDocument();
    expect(screen.getByText("City_Paris")).toBeInTheDocument();
    expect(screen.getByText("City_London")).toBeInTheDocument();
    // Result + use-when
    expect(
      screen.queryByText("✓ 1 text col → 2 number cols"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/feeding categories to ML models/),
    ).toBeInTheDocument();
  });
});

describe("AnimatedRemoveColumn — staged transition", () => {
  it("derives every surface from REMOVE_COLUMN_SAMPLE (single source)", () => {
    expect(REMOVE_COLUMN_SAMPLE.dropped).toBe("Age");
    expect(OP_PREVIEWS.drop?.after.columns).toEqual(["Name", "City"]);
    expect(OP_PREVIEWS.drop?.before.rows).toEqual(
      REMOVE_COLUMN_SAMPLE.rows.map((r) => [...r]),
    );
  });

  it("renders pills, picked cells and struck column with no replay", () => {
    const { container } = render(
      <AnimatedRemoveColumn label="Remove column" />,
    );

    for (const pill of REMOVE_COLUMN_PILLS) {
      expect(screen.getByText(pill.code)).toBeInTheDocument();
    }
    // Picked cells pulse in order; header struck as dropped
    expect(container.querySelectorAll(".od-before .od-src")).toHaveLength(2);
    const dropped = container.querySelector(".od-before .od-dropped");
    expect(dropped?.textContent).toBe("Age");
    // After table has no Age column
    const afterHeaders = Array.from(
      container.querySelectorAll(".od-after thead th"),
    ).map((th) => th.textContent);
    expect(afterHeaders).toEqual(["Name", "City"]);
    expect(screen.queryByText("✓ 3 cols → 2 cols")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Replay preview" }),
    ).not.toBeInTheDocument();
  });
});

describe("Batch-2 previews — export assemble + morphs", () => {
  it("export formats assemble pages with doc-verbatim pills", () => {
    const pdf = render(<AnimatedExportPdf label="PDF Report" />);
    expect(screen.getByText(EXPORT_PDF_PILLS[0].code)).toBeInTheDocument();
    expect(pdf.container.querySelectorAll(".as-page")).toHaveLength(3);
    expect(pdf.container.querySelector(".as-doc")).toBeInTheDocument();
    pdf.unmount();

    render(<AnimatedExportXlsx label="Excel Workbook" />);
    expect(screen.getByText(EXPORT_XLSX_PILLS[0].code)).toBeInTheDocument();
    render(<AnimatedExportDocx label="Word Document" />);
    expect(screen.getByText(EXPORT_DOCX_PILLS[0].code)).toBeInTheDocument();
    render(<AnimatedExportCsv label="Cleaned CSV" />);
    expect(screen.getByText(EXPORT_CSV_PILLS[0].code)).toBeInTheDocument();
    expect(screen.getByText("Name,Age")).toBeInTheDocument();
  });

  it("sort rows derive from SORT_ROWS_SAMPLE", () => {
    expect(OP_PREVIEWS.sort?.after.rows).toEqual([
      ["Ada", 42],
      ["Ben", 87],
      ["Dan", 91],
    ]);
    const { container } = render(<AnimatedSortRows label="Sort rows" />);
    expect(screen.getByText(SORT_ROWS_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".sr-before .sr-src")).toHaveLength(3);
    expect(container.querySelectorAll(".sr-after .sr-hit")).toHaveLength(3);
  });

  it("sample rows derive from SAMPLE_ROWS_SAMPLE", () => {
    expect(OP_PREVIEWS.sample?.after.rows).toEqual([
      ["Ben", 87],
      ["Dan", 91],
    ]);
    const { container } = render(<AnimatedSampleRows label="Sample rows" />);
    expect(screen.getByText(SAMPLE_ROWS_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".sp-before .sp-src")).toHaveLength(2);
    expect(screen.queryByText("✓ 5 rows → 2 sampled")).not.toBeInTheDocument();
  });

  it("missing values derive from MISSING_VALUES_SAMPLE", () => {
    const { container } = render(
      <AnimatedMissingValues label="Missing values" />,
    );
    expect(screen.getByText(MISSING_VALUES_PILLS[0].code)).toBeInTheDocument();
    expect(MISSING_VALUES_SAMPLE.rows).toHaveLength(3);
    expect(container.querySelector(".mv-before .mv-src")?.textContent).toBe(
      "—",
    );
    expect(screen.queryByText("✓ 1 gap → filled")).not.toBeInTheDocument();
    expect(container.querySelector(".mv-after .mv-hit")?.textContent).toBe(
      "27.5",
    );
  });
});
describe("Batch-1 previews — one file each, derived surfaces", () => {
  it("group-by derives from GROUP_BY_SAMPLE", () => {
    expect(OP_PREVIEWS.group?.after.rows).toEqual([
      ["EU", 60],
      ["US", 30],
    ]);
    const { container } = render(<AnimatedGroupBy label="Summarize" />);
    expect(screen.getByText(GROUP_BY_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".gb-before .gb-src")).toHaveLength(3);
    expect(container.querySelectorAll(".gb-after .gb-hit")).toHaveLength(2);
    expect(container.querySelector(".gb-consumed")?.textContent).toBe("Sales");
    expect(
      screen.queryByRole("button", { name: "Replay preview" }),
    ).not.toBeInTheDocument();
  });

  it("filter-rows derives from FILTER_ROWS_SAMPLE", () => {
    expect(OP_PREVIEWS.query?.after.rows).toEqual([
      ["Ben", 87],
      ["Dan", 91],
    ]);
    const { container } = render(<AnimatedFilterRows label="Filter rows" />);
    expect(screen.getByText(FILTER_ROWS_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".fr-before .fr-src")).toHaveLength(2);
    expect(container.querySelectorAll(".fr-cut")).toHaveLength(2);
    expect(screen.queryByText("✓ 4 rows → 2 kept")).not.toBeInTheDocument();
  });

  it("duplicates derives from DUPLICATES_SAMPLE", () => {
    const { container } = render(<AnimatedDuplicates label="Duplicates" />);
    expect(screen.getByText(DUPLICATES_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".dd-before .dd-src")).toHaveLength(4);
    expect(container.querySelector(".dd-cut")).toBeInTheDocument();
    expect(screen.queryByText("✓ 3 rows → 2 unique")).not.toBeInTheDocument();
  });

  it("t-test reveal derives from T_TEST_SAMPLE", () => {
    const { container } = render(<AnimatedTTest label="t-test" />);
    expect(screen.getByText(T_TEST_PILLS[0].code)).toBeInTheDocument();
    expect(screen.getByText(T_TEST_SAMPLE.claim)).toBeInTheDocument();
    expect(container.querySelectorAll(".tt-dot")).toHaveLength(6);
    expect(screen.getByText(T_TEST_SAMPLE.verdict)).toBeInTheDocument();
    expect(screen.getByText(/roughly bell-shaped/)).toBeInTheDocument();
  });
});
describe("AnimatedOneHot — staged transition", () => {
  it("derives every surface from ONE_HOT_SAMPLE (single source)", () => {
    expect(ONE_HOT_SAMPLE.values).toEqual(["Paris", "London", "Paris"]);
    expect(ONE_HOT_SAMPLE.encoded).toEqual(["City_Paris", "City_London"]);
    expect(OP_PREVIEWS.getDummies?.before.rows).toEqual(
      ONE_HOT_SAMPLE.values.map((v) => [v]),
    );
  });

  it("renders pills, staged cells and dropped header with no replay", () => {
    const { container } = render(
      <AnimatedOneHot label="One-hot" typeTag="getDummies" />,
    );

    // Code pills
    for (const pill of ONE_HOT_PILLS) {
      expect(screen.getByText(pill.code)).toBeInTheDocument();
    }
    // Staged source cells (pulse order = document order)
    const srcCells = container.querySelectorAll(".oh-before .oh-src");
    expect(srcCells).toHaveLength(3);
    // Hit cells staged for the split beat
    expect(container.querySelectorAll(".oh-after .oh-hit")).toHaveLength(3);
    expect(container.querySelectorAll(".oh-after .oh-zero")).toHaveLength(3);
    // Removal beat: original column struck through
    const dropped = container.querySelector(".oh-dropped");
    expect(dropped?.textContent).toBe("City");
    expect(
      screen.queryByRole("button", { name: "Replay preview" }),
    ).not.toBeInTheDocument();
  });
});

describe("Batch-3 previews — meter dialect + morphs", () => {
  it("logistic regression meter derives from LOGREG_SAMPLE", () => {
    const { container } = render(
      <AnimatedLogisticRegression label="Logistic regression" />,
    );
    expect(screen.getByText(LOGREG_PILLS[0].code)).toBeInTheDocument();
    expect(screen.getByText(LOGREG_SAMPLE.question)).toBeInTheDocument();
    expect(container.querySelectorAll(".mt-feat")).toHaveLength(2);
    expect(container.querySelector(".mt-fill")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(LOGREG_SAMPLE.verdict)).toBeInTheDocument();
  });

  it("random forest meter derives from RANDOM_FOREST_SAMPLE", () => {
    const { container } = render(
      <AnimatedRandomForest label="Random forest" />,
    );
    expect(screen.getByText(RANDOM_FOREST_PILLS[0].code)).toBeInTheDocument();
    expect(screen.getByText(RANDOM_FOREST_SAMPLE.question)).toBeInTheDocument();
    expect(container.querySelectorAll(".mt-feat")).toHaveLength(2);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(RANDOM_FOREST_SAMPLE.verdict)).toBeInTheDocument();
  });

  it("top-N derives from TOP_N_SAMPLE", () => {
    expect(OP_PREVIEWS.topN?.after.rows).toEqual([
      ["Dan", 91],
      ["Ben", 87],
    ]);
    const { container } = render(<AnimatedTopN label="Keep top N" />);
    expect(screen.getByText(TOP_N_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".tn-before .tn-src")).toHaveLength(2);
    expect(screen.queryByText("✓ 4 rows → top 2")).not.toBeInTheDocument();
  });

  it("rank derives from RANK_SAMPLE", () => {
    expect(OP_PREVIEWS.rank?.after.rows).toEqual([
      ["Ada", 42, 3],
      ["Ben", 87, 2],
      ["Dan", 91, 1],
    ]);
    const { container } = render(<AnimatedRank label="Rank" />);
    expect(screen.getByText(RANK_PILLS[0].code)).toBeInTheDocument();
    expect(container.querySelectorAll(".rk-before .rk-src")).toHaveLength(3);
    expect(container.querySelectorAll(".rk-after .rk-hit")).toHaveLength(3);
  });

  it("outliers derive from OUTLIERS_SAMPLE", () => {
    const { container } = render(<AnimatedOutliers label="Outliers" />);
    expect(screen.getByText(OUTLIERS_PILLS[0].code)).toBeInTheDocument();
    expect(OUTLIERS_SAMPLE.wild.value).toBe(95);
    expect(container.querySelector(".ol-before .ol-src")?.textContent).toBe(
      "95",
    );
    expect(container.querySelector(".ol-after .ol-hit")?.textContent).toBe(
      "30",
    );
    expect(screen.queryByText("✓ 95 → capped at 30")).not.toBeInTheDocument();
  });
});

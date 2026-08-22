import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { RenderSafeChart } from "@/components/Charts/RenderSafeChart";
import * as renderSafety from "@/components/Charts/renderSafety";
import { fixtures } from "@mocks/helpers";

vi.mock("@/components/Charts/renderSafety", () => ({
  checkRenderSafety: vi.fn(),
}));

describe("RenderSafeChart", () => {
  const mockDataset = fixtures.minimal;
  const mockMapping = { x: "x", y: "y" };

  it("renders children when it is perfectly safe", () => {
    vi.mocked(renderSafety.checkRenderSafety).mockReturnValue({
      isSafe: true,
      blocks: [],
      warnings: [],
    });

    render(
      <RenderSafeChart dataset={mockDataset} chartType="scatter" mapping={mockMapping}>
        <div data-testid="chart-child">My Chart</div>
      </RenderSafeChart>
    );

    expect(screen.getByTestId("chart-child")).toBeDefined();
    expect(screen.queryByText("Render Blocked")).toBeNull();
    expect(screen.queryByText("Render Warning")).toBeNull();
  });

  it("blocks rendering and shows error messages when unsafe", () => {
    vi.mocked(renderSafety.checkRenderSafety).mockReturnValue({
      isSafe: false,
      blocks: ["Too many data points for Scatter Chart", "Missing X axis"],
      warnings: [],
    });

    render(
      <RenderSafeChart dataset={mockDataset} chartType="scatter" mapping={mockMapping}>
        <div data-testid="chart-child">My Chart</div>
      </RenderSafeChart>
    );

    expect(screen.queryByTestId("chart-child")).toBeNull(); // children should NOT render
    expect(screen.getByText("Render Blocked")).toBeDefined();
    expect(screen.getByText("Too many data points for Scatter Chart")).toBeDefined();
    expect(screen.getByText("Missing X axis")).toBeDefined();
  });

  it("renders children but shows warnings when safe with warnings", () => {
    vi.mocked(renderSafety.checkRenderSafety).mockReturnValue({
      isSafe: true,
      blocks: [],
      warnings: ["Performance may be degraded above 50,000 rows"],
    });

    render(
      <RenderSafeChart dataset={mockDataset} chartType="scatter" mapping={mockMapping}>
        <div data-testid="chart-child">My Chart</div>
      </RenderSafeChart>
    );

    expect(screen.getByTestId("chart-child")).toBeDefined(); // children SHOULD render
    expect(screen.getByText("Render Warning")).toBeDefined();
    expect(screen.getByText("Performance may be degraded above 50,000 rows")).toBeDefined();
  });
});

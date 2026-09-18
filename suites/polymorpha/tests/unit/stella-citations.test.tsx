import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CitedMarkdown } from "@/stella/components/StellaMessage";

describe("CitedMarkdown functionality chips", () => {
  it("renders a labeled chip for a known functionality id", () => {
    render(<CitedMarkdown text="Try [functionality:tTest] for two groups." />);
    const chip = screen.getByLabelText(
      /Polymorpha capability: t-test — Analyse → Tests → Parametric/,
    );
    expect(chip.textContent).toBe("t-test");
    expect(chip.title).toBe("Analyse → Tests → Parametric");
    expect(screen.queryByText(/\[functionality:tTest\]/)).toBeNull();
  });

  it("leaves unknown ids as plain text (never a dead chip)", () => {
    render(<CitedMarkdown text="See [functionality:nope] here." />);
    expect(screen.getByText(/\[functionality:nope\]/)).toBeDefined();
  });

  it("renders plain markdown untouched when no citations exist", () => {
    render(<CitedMarkdown text="Just **bold** text." />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });
});

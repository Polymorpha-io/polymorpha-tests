/**
 * Preview registry meta-test — every Animated* export renders its shell
 * (header + one pill + Example kicker + use-when + data-stage accent).
 * This is what makes 150+ data-driven spec files safe to add: any spec
 * missing a pill, label, or stage fails here.
 */
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import * as Previews from "@/components/transitions-preview";
import { OP_PREVIEWS } from "@/components/transitions-preview";

const animated = Object.entries(Previews).filter(
  (entry): entry is [string, ComponentType<{ label: string }>] =>
    entry[0].startsWith("Animated") && typeof entry[1] === "function",
);

describe("preview registry — every Animated preview renders", () => {
  afterEach(cleanup);

  it(`covers the full rollout (${animated.length} previews)`, () => {
    expect(animated.length).toBeGreaterThan(150);
  });

  for (const [name, Comp] of animated) {
    it(`${name} renders header + pill + use-when + stage`, () => {
      const { container } = render(<Comp label={name} />);
      // Header carries the label
      expect(screen.getByText(name)).toBeInTheDocument();
      // Exactly-one-pill policy: at least one documented pill renders
      expect(container.querySelector(".oh-pill")).not.toBeNull();
      // Illustrations are labeled Example, never real data (G30).
      expect(screen.getByText("Example")).toBeInTheDocument();
      // Usage hint + pipeline-stage accent
      expect(container.querySelector(".preview-tip-use")).not.toBeNull();
      expect(container.querySelector("[data-stage]")).not.toBeNull();
    });
  }
});

describe("OP_PREVIEWS coverage — wrangle", () => {
  it("covers all 47 wrangle op types", () => {
    expect(Object.keys(OP_PREVIEWS)).toHaveLength(47);
  });

  it("derives static specs from the new morph consts (no copied values)", () => {
    expect(OP_PREVIEWS.pivot?.after.columns).toEqual(["Region", "Q1", "Q2"]);
    expect(OP_PREVIEWS.join?.after.columns).toEqual(["Code", "Sales", "Rate"]);
    expect(OP_PREVIEWS.balance?.before.rows).toHaveLength(4);
    expect(OP_PREVIEWS.transpose?.rule).toContain("swap");
  });
});

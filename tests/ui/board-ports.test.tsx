// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { BoardSvg } from "../../src/ui/board/BoardSvg";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { legalTargets } from "../../src/state/legalTargets";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

describe("BoardSvg ports", () => {
  test("renders one visible type indicator for every board port", () => {
    const state = createInitialGame(players3, createBoard({ mode: "beginner" }));
    const { container } = render(
      <BoardSvg
        state={state}
        legal={legalTargets(state)}
        onVertex={() => {}}
        onEdge={() => {}}
        onHex={() => {}}
      />,
    );

    const indicators = container.querySelectorAll("[data-port-kind]");
    expect(indicators).toHaveLength(state.board.ports.length);

    for (const port of state.board.ports) {
      const indicator = container.querySelector(`[data-port-edge="${port.edge}"]`);
      expect(indicator).not.toBeNull();
      expect(indicator?.getAttribute("data-port-kind")).toBe(port.kind);
      expect(indicator?.textContent).toContain(port.kind === "any" ? "3:1" : "2:1");
    }
  });
});

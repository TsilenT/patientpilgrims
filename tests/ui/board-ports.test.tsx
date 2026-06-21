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

  test("draws obvious dock piers from each port to both settlement spots", () => {
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

    for (const port of state.board.ports) {
      const indicator = container.querySelector(`[data-port-edge="${port.edge}"]`);
      expect(indicator).not.toBeNull();

      const piers = indicator!.querySelectorAll("line.port-pier");
      const halos = indicator!.querySelectorAll("line.port-pier-halo");
      expect(piers).toHaveLength(2);
      expect(halos).toHaveLength(0);

      const lengths = Array.from(piers, (pier) => {
        const x1 = Number(pier.getAttribute("x1"));
        const y1 = Number(pier.getAttribute("y1"));
        const x2 = Number(pier.getAttribute("x2"));
        const y2 = Number(pier.getAttribute("y2"));
        expect(Number(pier.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(4.2);
        return Math.hypot(x2 - x1, y2 - y1);
      });

      for (const length of lengths) {
        expect(length).toBeGreaterThan(50);
      }
      expect(Math.abs(lengths[0]! - lengths[1]!)).toBeGreaterThan(5);
    }
  });
});

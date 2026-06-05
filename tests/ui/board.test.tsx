// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import { BoardSvg } from "../../src/ui/board/BoardSvg";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";

function setupGame() {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

test("renders 19 hexes and marks the robber hex", () => {
  const g = setupGame();
  const { container } = render(<BoardSvg state={g} onVertex={() => {}} onEdge={() => {}} onHex={() => {}} legal={{ vertices: new Set(), edges: new Set(), hexes: new Set() }} />);
  expect(container.querySelectorAll("[data-hex]")).toHaveLength(19);
  expect(container.querySelector(`[data-robber="true"]`)).not.toBeNull();
  const robberHex = container.querySelector(`[data-robber="true"]`)!;
  expect(robberHex.getAttribute("data-kind")).toBe("desert");
});

test("renders placed roads and buildings in owner color", () => {
  const g = setupGame();
  const vid = topology().vertexIds[0]!;
  const eid = topology().edgeIds[0]!;
  g.board.buildings[vid] = { owner: 0, type: "settlement" };
  g.board.roads[eid] = { owner: 1 };
  const { container } = render(<BoardSvg state={g} onVertex={() => {}} onEdge={() => {}} onHex={() => {}} legal={{ vertices: new Set(), edges: new Set(), hexes: new Set() }} />);
  const building = container.querySelector(`[data-building="${vid}"]`);
  const road = container.querySelector(`[data-road="${eid}"]`);
  expect(building).not.toBeNull();
  expect(road).not.toBeNull();
  expect(building!.getAttribute("fill")).toBe("red"); // player 0
  expect(road!.getAttribute("stroke")).toBe("blue"); // player 1
});

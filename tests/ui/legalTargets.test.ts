import { describe, it, expect } from "vitest";
import { legalTargets } from "../../src/state/legalTargets";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";

function setupGame() {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

describe("legalTargets", () => {
  it("in setupSettlement, every unoccupied distance-respecting vertex is legal and no edges are", () => {
    const g = setupGame();
    const t = legalTargets(g);
    expect(t.vertices.size).toBeGreaterThan(0);
    expect(t.edges.size).toBe(0);
    const some = [...t.vertices][0]!;
    expect(topology().vertexIds.includes(some)).toBe(true);
  });

  it("in movingRobber, every hex except the current robber hex is legal", () => {
    const g = setupGame();
    g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
    const t = legalTargets(g);
    expect(t.hexes.has(g.board.robber)).toBe(false);
    expect(t.hexes.size).toBe(topology().hexIds.length - 1);
  });
});

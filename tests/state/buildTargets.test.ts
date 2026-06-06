import { describe, it, expect } from "vitest";
import { buildTargets } from "../../src/state/legalTargets";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}

describe("buildTargets", () => {
  it("city mode targets only the active player's settlements", () => {
    const g = mainGame();
    const v0 = topology().vertexIds[0]!;
    const v1 = topology().vertexIds[10]!;
    g.board.buildings[v0] = { owner: 0, type: "settlement" };
    g.board.buildings[v1] = { owner: 1, type: "settlement" }; // opponent
    const t = buildTargets(g, "city");
    expect(t.vertices.has(v0)).toBe(true);
    expect(t.vertices.has(v1)).toBe(false); // not mine
    expect(t.edges.size).toBe(0);
  });

  it("road mode in main returns only edges, none in a fresh game (no network)", () => {
    const t = buildTargets(mainGame(), "road");
    expect(t.vertices.size).toBe(0);
    expect(t.edges.size).toBe(0); // no roads placed yet → nothing connects
  });

  it("settlement mode in setup offers distance-legal vertices", () => {
    const g = createInitialGame(
      [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
      createBoard({ mode: "beginner" }),
    );
    // fresh game starts in setupSettlement
    const t = buildTargets(g, "settlement");
    expect(t.vertices.size).toBeGreaterThan(0);
    expect(t.edges.size).toBe(0);
  });
});

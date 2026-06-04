import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";
import { legalSetupSettlements, legalSetupRoads } from "../../src/engine/placement";
import { totalCards } from "../../src/engine/resources";
import type { GameState } from "../../src/engine/types";

const rng = mulberry32(1);
const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

function game(): GameState {
  return createInitialGame(players3, createBoard({ mode: "beginner" }));
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("setup snake draft", () => {
  it("places a settlement then a connected road, advancing the snake", () => {
    let g = game();
    const v = legalSetupSettlements(g.board)[0]!;
    let r = apply(g, { type: "setupSettlement", vertex: v }, rng);
    expectOk(r);
    g = r.state;
    expect(g.turn.subPhase).toBe("setupRoad");
    expect(g.board.buildings[v]).toEqual({ owner: 0, type: "settlement" });
    expect(g.players[0]!.victoryPoints).toBe(1);

    const e = legalSetupRoads(g.board, v)[0]!;
    r = apply(g, { type: "setupRoad", edge: e }, rng);
    expectOk(r);
    g = r.state;
    expect(g.board.roads[e]).toEqual({ owner: 0 });
    expect(g.turn.activeSeat).toBe(1);
    expect(g.turn.subPhase).toBe("setupSettlement");
  });

  it("rejects re-using an occupied vertex and a disconnected road", () => {
    let g = game();
    const v = legalSetupSettlements(g.board)[0]!;
    let r = apply(g, { type: "setupSettlement", vertex: v }, rng);
    expectOk(r);
    g = r.state;
    // a road attached to a DIFFERENT legal vertex is rejected (must attach to v)
    const disconnected = legalSetupRoads(g.board, legalSetupSettlements(g.board)[0]!)[0]!;
    expect(apply(g, { type: "setupRoad", edge: disconnected }, rng).ok).toBe(false);
    const e = legalSetupRoads(g.board, v)[0]!;
    r = apply(g, { type: "setupRoad", edge: e }, rng);
    expectOk(r);
    g = r.state;
    expect(apply(g, { type: "setupSettlement", vertex: v }, rng).ok).toBe(false);
  });

  it("runs a full 3-player setup and grants 2nd-settlement resources", () => {
    let g = game();
    while (g.phase === "setup") {
      const sv = legalSetupSettlements(g.board)[0]!;
      let r = apply(g, { type: "setupSettlement", vertex: sv }, rng);
      expectOk(r);
      g = r.state;
      const se = legalSetupRoads(g.board, sv)[0]!;
      r = apply(g, { type: "setupRoad", edge: se }, rng);
      expectOk(r);
      g = r.state;
    }
    expect(g.phase).toBe("main");
    expect(g.turn).toEqual({ activeSeat: 0, subPhase: "awaitingRoll" });
    for (const p of g.players) {
      expect(p.pieces.settlements).toBe(3);
      expect(p.pieces.roads).toBe(13);
      expect(p.victoryPoints).toBe(2);
    }
    const granted = g.players.reduce((s, p) => s + totalCards(p.resources), 0);
    expect(granted).toBeGreaterThan(0);
    expect(g.setup).toBeUndefined();
  });
});

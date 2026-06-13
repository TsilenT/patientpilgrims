import { describe, it, expect } from "vitest";
import { normalizeState } from "../../src/net/normalize";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";

/** Simulate a Firebase round-trip: RTDB drops empty objects/arrays. */
function stripEmpties(state: GameState): GameState {
  const s = structuredClone(state) as unknown as Record<string, unknown>;
  const board = s.board as Record<string, unknown>;
  delete board.buildings; // was {}
  delete board.roads; // was {}
  delete s.log; // was []
  delete s.tradeOffers; // was []
  delete s.awards; // was {}
  delete s.turnOrder; // legacy games saved before turn order was explicit
  for (const p of s.players as Array<Record<string, unknown>>) delete p.devCards; // was []
  return s as unknown as GameState;
}

function freshGame(): GameState {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

describe("normalizeState", () => {
  it("returns null for a missing game", () => {
    expect(normalizeState(null)).toBeNull();
  });

  it("rehydrates collections that Firebase dropped as empty", () => {
    const stripped = stripEmpties(freshGame());
    // sanity: the round-trip really removed them
    expect((stripped.board as { buildings?: unknown }).buildings).toBeUndefined();

    const s = normalizeState(stripped)!;
    expect(s.board.buildings).toEqual({});
    expect(s.board.roads).toEqual({});
    expect(s.log).toEqual([]);
    expect(s.tradeOffers).toEqual([]);
    expect(s.awards).toEqual({});
    expect(s.turnOrder).toEqual([0, 1, 2]);
    for (const p of s.players) expect(p.devCards).toEqual([]);
  });

  it("rehydrates an emptied devDeck (late-game) to an array", () => {
    const g = freshGame();
    delete (g as { devDeck?: unknown }).devDeck;
    expect(normalizeState(g)!.devDeck).toEqual([]);
  });

  it("leaves populated collections intact", () => {
    const g = freshGame();
    const s = normalizeState(structuredClone(g))!;
    expect(Object.keys(s.board.tiles).length).toBe(Object.keys(g.board.tiles).length);
    expect(s.players.length).toBe(3);
    expect(s.bank).toEqual(g.bank);
  });

  it("derives missing turnOrder from the setup placement log", () => {
    const g = freshGame();
    g.phase = "main";
    g.turn = { activeSeat: 2, subPhase: "awaitingRoll" };
    delete g.setup;
    delete (g as { turnOrder?: unknown }).turnOrder;
    g.log = [
      { type: "setupSettlement", seat: 2, vertex: "v1" },
      { type: "setupRoad", seat: 2, edge: "e1" },
      { type: "setupSettlement", seat: 0, vertex: "v2" },
      { type: "setupRoad", seat: 0, edge: "e2" },
      { type: "setupSettlement", seat: 1, vertex: "v3" },
      { type: "setupRoad", seat: 1, edge: "e3" },
      { type: "setupSettlement", seat: 1, vertex: "v4" },
      { type: "setupRoad", seat: 1, edge: "e4" },
      { type: "setupSettlement", seat: 0, vertex: "v5" },
      { type: "setupRoad", seat: 0, edge: "e5" },
      { type: "setupSettlement", seat: 2, vertex: "v6" },
      { type: "setupRoad", seat: 2, edge: "e6" },
    ];

    const s = normalizeState(g)!;

    expect(s.turnOrder).toEqual([2, 0, 1]);
  });
});

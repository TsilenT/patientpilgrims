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
});

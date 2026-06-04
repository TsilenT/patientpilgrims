import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const players3 = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}
function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("dev-card play timing", () => {
  it("endTurn clears the ending player's boughtThisTurn flags", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: true, played: false });
    const r = apply(g, { type: "endTurn" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.devCards[0]!.boughtThisTurn).toBe(false);
  });
});

export { players3, rngOf, mainGame, expectOk };

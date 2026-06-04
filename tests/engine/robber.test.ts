import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

/** Rng whose nextInt returns queued RAW values (not die faces). */
function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}

/** dice faces 3 & 4 (sum 7): roll does nextInt(6)+1, so feed 2,3. */
function sevenRng(): Rng {
  return rngOf(2, 3);
}

function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "awaitingRoll" };
  delete g.setup;
  return g;
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("rolling a 7 -> robber move", () => {
  it("with no one over 7 cards: no obligations, goes to movingRobber, produces nothing", () => {
    const g = mainGame();
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toBeUndefined();
  });

  it("a player holding more than 7 cards owes floor(half) but the roller still moves on", () => {
    const g = mainGame();
    g.players[1]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toEqual({ 1: 4 });
  });

  it("exactly 7 cards owes nothing", () => {
    const g = mainGame();
    g.players[1]!.resources = { wood: 7, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toBeUndefined();
  });
});

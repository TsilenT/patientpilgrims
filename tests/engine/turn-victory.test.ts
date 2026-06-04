import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";
import type { GameState } from "../../src/engine/types";

const rng = mulberry32(1);
const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "main", dice: [3, 4] };
  delete g.setup;
  return g;
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("endTurn", () => {
  it("advances to the next seat and resets to awaitingRoll", () => {
    const g = mainGame();
    const r = apply(g, { type: "endTurn" }, rng);
    expectOk(r);
    expect(r.state.turn.activeSeat).toBe(1);
    expect(r.state.turn.subPhase).toBe("awaitingRoll");
    expect(r.state.turn.dice).toBeUndefined();
  });

  it("wraps around from the last seat to seat 0", () => {
    const g = mainGame();
    g.turn.activeSeat = 2;
    const r = apply(g, { type: "endTurn" }, rng);
    expectOk(r);
    expect(r.state.turn.activeSeat).toBe(0);
  });

  it("requires having rolled before ending the turn", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    expect(apply(g, { type: "endTurn" }, rng).ok).toBe(false);
  });
});

describe("victory", () => {
  it("finishes the game when a player reaches 10 VP", () => {
    const g = mainGame();
    g.players[0]!.victoryPoints = 10;
    const r = apply(g, { type: "endTurn" }, rng);
    expectOk(r);
    expect(r.state.phase).toBe("finished");
    expect(r.state.winner).toBe(0);
  });

  it("blocks all actions once the game is finished", () => {
    const g = mainGame();
    g.players[0]!.victoryPoints = 10;
    const r = apply(g, { type: "endTurn" }, rng);
    expectOk(r);
    expect(apply(r.state, { type: "rollDice" }, rng).ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";
import { recomputeVictoryPoints } from "../../src/engine/scoring/victory";

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
/** A target hex distinct from the robber, with no opponent buildings (no victim needed). */
function emptyTargetHex(g: GameState): string {
  return topology().hexIds.find((h) => h !== g.board.robber)!;
}

describe("Largest-Army scoring", () => {
  it("awards +2 VP to the seat holding largestArmy", () => {
    const state = mainGame();
    state.awards.largestArmy = 0;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it("removes the +2 VP when the largestArmy award is cleared", () => {
    const state = mainGame();
    state.awards.largestArmy = 0;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(2);

    delete state.awards.largestArmy;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(0);
  });
});

describe("playKnight", () => {
  function withKnight(g: GameState): void {
    g.players[0]!.devCards.push({ type: "knight", boughtThisTurn: false, played: false });
  }

  it("after roll: enters movingRobber, records robberReturn=main, bumps count; moveRobber returns to main", () => {
    const g = mainGame(); // subPhase === "main"
    withKnight(g);
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.turn.robberReturn).toBe("main");
    expect(r.state.players[0]!.knightsPlayed).toBe(1);

    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.board.robber).toBe(hex);
    expect(moved.state.turn.subPhase).toBe("main");
  });

  it("before roll: enters movingRobber, records robberReturn=awaitingRoll; after moveRobber the player still rolls", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    withKnight(g);
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.turn.robberReturn).toBe("awaitingRoll");
    expect(r.state.players[0]!.knightsPlayed).toBe(1);

    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.turn.subPhase).toBe("awaitingRoll");

    // a non-7 roll (dice [1,1] = 2) advances to main
    const rolled = apply(moved.state, { type: "rollDice" }, rngOf(0, 0));
    expectOk(rolled);
    expect(rolled.state.turn.subPhase).toBe("main");
  });

  it("cannot play a knight bought this turn", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "knight", boughtThisTurn: true, played: false });
    const r = apply(g, { type: "playKnight" }, rngOf());
    expect(r.ok).toBe(false);
    expect(g.players[0]!.knightsPlayed).toBe(0);
  });

  it("only one dev card may be played per turn (knight then another dev card is rejected)", () => {
    const g = mainGame();
    withKnight(g);
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });

    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    // resolve the robber so we're back in "main" (where monopoly is allowed by subPhase)
    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.turn.subPhase).toBe("main");

    // second dev card this turn is rejected by devCardPlayedThisTurn
    const second = apply(moved.state, { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(second.ok).toBe(false);
  });

  it("third knight grants the Largest Army award (+2 VP)", () => {
    const g = mainGame();
    g.players[0]!.knightsPlayed = 2; // about to play the 3rd
    withKnight(g);
    const before = g.players[0]!.victoryPoints;
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.knightsPlayed).toBe(3);
    expect(r.state.awards.largestArmy).toBe(0);
    expect(r.state.players[0]!.victoryPoints).toBe(before + 2);
  });
});

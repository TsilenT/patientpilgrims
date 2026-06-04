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

describe("discard action", () => {
  function rolled7WithOverflow(): GameState {
    const g = mainGame();
    g.players[1]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    g.bank.wood = 19 - 8; // pretend the 8 came from the bank, so totals stay sane
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.discardObligations).toEqual({ 1: 4 });
    return r.state;
  }

  it("a valid discard returns cards to the bank and clears the obligation (turn unchanged)", () => {
    const s = rolled7WithOverflow();
    const before = s.bank.wood;
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expectOk(r);
    expect(r.state.players[1]!.resources.wood).toBe(4);
    expect(r.state.bank.wood).toBe(before + 4);
    expect(r.state.discardObligations).toBeUndefined();
    expect(r.state.turn.subPhase).toBe("movingRobber"); // discard does NOT move the robber
  });

  it("rejects a discard of the wrong count", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a discard from a player who owes nothing", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 0, cards: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects discarding cards the player does not have", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 4 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });
});

describe("moveRobber + steal", () => {
  function movingRobberState(): { s: GameState; targetHex: string } {
    const g = mainGame();
    const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
    const victimVertex = topology().hexVertices.get(targetHex)![0]!;
    g.board.buildings[victimVertex] = { owner: 1, type: "settlement" };
    g.players[1]!.resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    g.turn.subPhase = "movingRobber";
    return { s: g, targetHex };
  }

  it("moves the robber, steals one random card, and returns to main", () => {
    const { s, targetHex } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: targetHex, victim: 1 }, rngOf(0));
    expectOk(r);
    expect(r.state.board.robber).toBe(targetHex);
    expect(r.state.players[1]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.wood).toBe(1);
    expect(r.state.turn.subPhase).toBe("main");
  });

  it("rejects moving the robber to its current hex", () => {
    const { s } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: s.board.robber }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("requires choosing a victim when an eligible target exists", () => {
    const { s, targetHex } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: targetHex }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("moves with no steal when no adjacent opponent has cards", () => {
    const g = mainGame();
    const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
    g.turn.subPhase = "movingRobber";
    const r = apply(g, { type: "moveRobber", hex: targetHex }, rngOf());
    expectOk(r);
    expect(r.state.board.robber).toBe(targetHex);
    expect(r.state.turn.subPhase).toBe("main");
  });
});

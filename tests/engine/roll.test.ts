import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import { totalCards } from "../../src/engine/resources";
import type { GameState, Resource } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

/** An Rng that returns scripted die faces (1..6) for nextInt(6). */
function scriptedRng(d1: number, d2: number): Rng {
  const q = [d1 - 1, d2 - 1];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}

/** Two die faces summing to n (n in 2..12, n !== 7). */
function diceFor(n: number): [number, number] {
  for (let a = 1; a <= 6; a++) {
    const b = n - a;
    if (b >= 1 && b <= 6) return [a, b];
  }
  throw new Error(`no dice for ${n}`);
}

function setup(): { g: GameState; hid: string; v: string; number: number; kind: Resource } {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  const hid = topology().hexIds.find(
    (h) => g.board.tiles[h]!.number !== undefined && h !== g.board.robber,
  )!;
  const tile = g.board.tiles[hid]!;
  const v = topology().hexVertices.get(hid)![0]!;
  g.board.buildings[v] = { owner: 0, type: "settlement" };
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "awaitingRoll" };
  delete g.setup;
  return { g, hid, v, number: tile.number!, kind: tile.kind as Resource };
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("rollDice + production", () => {
  it("a settlement produces 1 of its hex's resource and moves to subPhase main", () => {
    const { g, number, kind } = setup();
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(r.state.players[0]!.resources[kind]).toBe(1);
    expect(r.state.turn.subPhase).toBe("main");
    expect(r.state.turn.dice).toEqual(diceFor(number));
  });

  it("a city produces 2", () => {
    const { g, v, number, kind } = setup();
    g.board.buildings[v] = { owner: 0, type: "city" };
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(r.state.players[0]!.resources[kind]).toBe(2);
  });

  it("the robber's hex produces nothing", () => {
    const { g, hid, number, kind } = setup();
    g.board.robber = hid;
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(r.state.players[0]!.resources[kind]).toBe(0);
  });

  it("a 7 produces nothing and enters the robber move", () => {
    const { g } = setup();
    const r = apply(g, { type: "rollDice" }, scriptedRng(3, 4));
    expectOk(r);
    expect(r.state.turn.dice).toEqual([3, 4]);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    const total = r.state.players.reduce((s, p) => s + totalCards(p.resources), 0);
    expect(total).toBe(0);
  });

  it("insufficient bank with multiple claimants yields nothing", () => {
    const { g, hid, number, kind } = setup();
    const vs = topology().hexVertices.get(hid)!;
    g.board.buildings = {};
    g.board.buildings[vs[0]!] = { owner: 0, type: "settlement" };
    g.board.buildings[vs[2]!] = { owner: 1, type: "settlement" };
    g.bank[kind] = 1;
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(r.state.players[0]!.resources[kind]).toBe(0);
    expect(r.state.players[1]!.resources[kind]).toBe(0);
    expect(r.state.bank[kind]).toBe(1);
  });

  it("a lone claimant gets only what the bank has", () => {
    const { g, hid, number, kind } = setup();
    const vs = topology().hexVertices.get(hid)!;
    g.board.buildings = {};
    g.board.buildings[vs[0]!] = { owner: 0, type: "city" };
    g.bank[kind] = 1;
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(r.state.players[0]!.resources[kind]).toBe(1);
    expect(r.state.bank[kind]).toBe(0);
  });
});

describe("roll gains recorded in the log", () => {
  const lastRoll = (g: GameState) => g.log[g.log.length - 1]!;

  it("records each seat's actual gains on the roll entry", () => {
    const { g, v, number, kind } = setup();
    g.board.buildings[v] = { owner: 0, type: "city" }; // 2 of kind
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(lastRoll(r.state).gains).toEqual({ 0: { [kind]: 2 } });
  });

  it("omits gains on a 7", () => {
    const { g } = setup();
    const r = apply(g, { type: "rollDice" }, scriptedRng(3, 4));
    expectOk(r);
    expect(lastRoll(r.state).gains).toBeUndefined();
  });

  it("records an empty gains object when nothing is produced", () => {
    const { g, hid, number } = setup();
    g.board.robber = hid; // robbed hex → no production
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(lastRoll(r.state).gains).toEqual({});
  });

  it("records resources blocked by the robber for each affected player", () => {
    const { g, hid, number } = setup();
    const vs = topology().hexVertices.get(hid)!;
    g.board.robber = hid;
    g.board.buildings = {
      [vs[0]!]: { owner: 0, type: "city" },
      [vs[2]!]: { owner: 1, type: "settlement" },
    };
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(lastRoll(r.state).blocked).toEqual({ 0: 2, 1: 1 });
  });

  it("records only what the bank could pay a lone claimant", () => {
    const { g, hid, number, kind } = setup();
    const vs = topology().hexVertices.get(hid)!;
    g.board.buildings = {};
    g.board.buildings[vs[0]!] = { owner: 0, type: "city" }; // wants 2
    g.bank[kind] = 1;
    const r = apply(g, { type: "rollDice" }, scriptedRng(...diceFor(number)));
    expectOk(r);
    expect(lastRoll(r.state).gains).toEqual({ 0: { [kind]: 1 } });
  });
});

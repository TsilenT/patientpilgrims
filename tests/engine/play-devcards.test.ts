import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";
import { topology } from "../../src/engine/board";

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

describe("monopoly", () => {
  function withMonopoly(): GameState {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });
    g.players[1]!.resources = { wood: 0, brick: 3, sheep: 0, wheat: 0, ore: 0 };
    g.players[2]!.resources = { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 };
    return g;
  }
  it("takes all of one resource from every opponent", () => {
    const r = apply(withMonopoly(), { type: "playMonopoly", resource: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.brick).toBe(5);
    expect(r.state.players[1]!.resources.brick).toBe(0);
    expect(r.state.players[2]!.resources.brick).toBe(0);
    expect(r.state.turn.devCardPlayedThisTurn).toBe(true);
  });
  it("rejects when no playable monopoly card is held", () => {
    const r = apply(mainGame(), { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });
});

describe("year of plenty", () => {
  function withYoP(): GameState {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "yearOfPlenty", boughtThisTurn: false, played: false });
    return g;
  }
  it("takes two resources from the bank", () => {
    const g = withYoP();
    const r = apply(g, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wheat).toBe(1);
    expect(r.state.players[0]!.resources.ore).toBe(1);
    expect(r.state.bank.wheat).toBe(18);
    expect(r.state.bank.ore).toBe(18);
  });
  it("can take two of the same resource", () => {
    const r = apply(withYoP(), { type: "playYearOfPlenty", resources: ["sheep", "sheep"] }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.sheep).toBe(2);
    expect(r.state.bank.sheep).toBe(17);
  });
  it("rejects if the bank cannot supply both", () => {
    const g = withYoP(); g.bank.ore = 1;
    const r = apply(g, { type: "playYearOfPlenty", resources: ["ore", "ore"] }, rngOf());
    expect(r.ok).toBe(false);
  });
});

describe("road building", () => {
  it("places two free roads connected to the player's network", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "roadBuilding", boughtThisTurn: false, played: false });
    // seed a settlement so the player has a network anchor
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    const e1 = topology().vertexEdges.get(v)![0]!;
    const before = g.players[0]!.pieces.roads;
    // pick a second edge adjacent to e1's far vertex
    const [a, b] = topology().edgeVertices.get(e1)!;
    const farV = a === v ? b : a;
    const e2 = topology().vertexEdges.get(farV)!.find((e) => e !== e1)!;
    const r = apply(g, { type: "playRoadBuilding", edges: [e1, e2] }, rngOf());
    expectOk(r);
    expect(r.state.board.roads[e1]!.owner).toBe(0);
    expect(r.state.board.roads[e2]!.owner).toBe(0);
    expect(r.state.players[0]!.pieces.roads).toBe(before - 2); // FREE but still uses stock
    expect(r.state.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  });
  it("rejects an edge that doesn't connect to the network", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "roadBuilding", boughtThisTurn: false, played: false });
    const lone = topology().edgeIds[0]!;
    const r = apply(g, { type: "playRoadBuilding", edges: [lone] }, rngOf());
    expect(r.ok).toBe(false);
  });
});

export { players3, rngOf, mainGame, expectOk };

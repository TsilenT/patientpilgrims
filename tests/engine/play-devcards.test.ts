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
function awaitingRollGame(): GameState {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
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
  it("can be played before rolling", () => {
    const g = withMonopoly();
    g.turn.subPhase = "awaitingRoll";
    const r = apply(g, { type: "playMonopoly", resource: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.brick).toBe(5);
    expect(r.state.turn.subPhase).toBe("awaitingRoll");
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
  it("can be played before rolling", () => {
    const g = withYoP();
    g.turn.subPhase = "awaitingRoll";
    const r = apply(g, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wheat).toBe(1);
    expect(r.state.players[0]!.resources.ore).toBe(1);
    expect(r.state.turn.subPhase).toBe("awaitingRoll");
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
  function withRoadBuilding(): { g: GameState; e1: string; e2: string; before: number } {
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
    return { g, e1, e2, before };
  }

  it("places two free roads connected to the player's network", () => {
    const { g, e1, e2, before } = withRoadBuilding();
    const r = apply(g, { type: "playRoadBuilding", edges: [e1, e2] }, rngOf());
    expectOk(r);
    expect(r.state.board.roads[e1]!.owner).toBe(0);
    expect(r.state.board.roads[e2]!.owner).toBe(0);
    expect(r.state.players[0]!.pieces.roads).toBe(before - 2); // FREE but still uses stock
    expect(r.state.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  });
  it("can be played before rolling", () => {
    const { g, e1, e2, before } = withRoadBuilding();
    g.turn.subPhase = "awaitingRoll";
    const r = apply(g, { type: "playRoadBuilding", edges: [e1, e2] }, rngOf());
    expectOk(r);
    expect(r.state.board.roads[e1]!.owner).toBe(0);
    expect(r.state.board.roads[e2]!.owner).toBe(0);
    expect(r.state.players[0]!.pieces.roads).toBe(before - 2);
    expect(r.state.turn.subPhase).toBe("awaitingRoll");
  });
  it("rejects an edge that doesn't connect to the network", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "roadBuilding", boughtThisTurn: false, played: false });
    const lone = topology().edgeIds[0]!;
    const r = apply(g, { type: "playRoadBuilding", edges: [lone] }, rngOf());
    expect(r.ok).toBe(false);
  });
});

describe("dev-card timing rules", () => {
  it("only one dev card may be played per turn", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });
    g.players[0]!.devCards.push({ type: "yearOfPlenty", boughtThisTurn: false, played: false });
    let r = apply(g, { type: "playMonopoly", resource: "brick" }, rngOf());
    expectOk(r);
    const r2 = apply(r.state, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expect(r2.ok).toBe(false);
  });
  it("a card bought this turn cannot be played", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = ["monopoly"];
    const bought = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(bought);
    const played = apply(bought.state, { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(played.ok).toBe(false);
  });
  it("a card bought this turn cannot be played before rolling", () => {
    const g = awaitingRollGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: true, played: false });
    const played = apply(g, { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(played.ok).toBe(false);
  });
  it("rejects non-knight dev cards while moving the robber", () => {
    const g = mainGame();
    g.turn.subPhase = "movingRobber";
    g.players[0]!.devCards.push({ type: "yearOfPlenty", boughtThisTurn: false, played: false });
    const r = apply(g, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expect(r.ok).toBe(false);
  });
  it("after the turn ends, a card bought this turn becomes playable next turn", () => {
    let s = mainGame();
    s.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: true, played: false });
    // bought this turn -> not playable yet
    const blocked = apply(s, { type: "playMonopoly", resource: "wheat" }, rngOf());
    expect(blocked.ok).toBe(false);
    // cycle a full round (3 players) back to seat 0; rngOf(0, 0) -> dice [1,1] = 2 (never a 7)
    const step = (action: Parameters<typeof apply>[1], rng = rngOf()) => {
      const res = apply(s, action, rng);
      expectOk(res);
      s = res.state;
    };
    step({ type: "endTurn" });                  // seat 0 ends -> clears its boughtThisTurn; seat 1 awaitingRoll
    step({ type: "rollDice" }, rngOf(0, 0));     // seat 1 -> main
    step({ type: "endTurn" });                   // seat 2 awaitingRoll
    step({ type: "rollDice" }, rngOf(0, 0));     // seat 2 -> main
    step({ type: "endTurn" });                   // seat 0 awaitingRoll
    step({ type: "rollDice" }, rngOf(0, 0));     // seat 0 -> main
    // back on seat 0's turn, the card is no longer boughtThisTurn -> playable
    const played = apply(s, { type: "playMonopoly", resource: "wheat" }, rngOf());
    expectOk(played);
  });
});

export { players3, rngOf, mainGame, expectOk };

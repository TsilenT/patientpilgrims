import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
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
  g.turn = { activeSeat: 0, subPhase: "main" };
  delete g.setup;
  return g;
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("building", () => {
  it("builds a road connected to your settlement, returning cost to the bank", () => {
    const g = mainGame();
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    const edge = topology().vertexEdges.get(v)![0]!;
    g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
    const r = apply(g, { type: "buildRoad", edge }, rng);
    expectOk(r);
    expect(r.state.board.roads[edge]).toEqual({ owner: 0 });
    expect(r.state.players[0]!.pieces.roads).toBe(14);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.bank.wood).toBe(20);
  });

  it("builds a settlement on your network respecting distance", () => {
    const g = mainGame();
    const edge = topology().edgeIds[0]!;
    g.board.roads[edge] = { owner: 0 };
    const v = topology().edgeVertices.get(edge)![0]!;
    g.players[0]!.resources = { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 };
    const r = apply(g, { type: "buildSettlement", vertex: v }, rng);
    expectOk(r);
    expect(r.state.board.buildings[v]).toEqual({ owner: 0, type: "settlement" });
    expect(r.state.players[0]!.victoryPoints).toBe(1);
    expect(r.state.players[0]!.pieces.settlements).toBe(4);
  });

  it("rejects a settlement that is off your road network", () => {
    const g = mainGame();
    const v = topology().vertexIds[0]!;
    g.players[0]!.resources = { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 };
    expect(apply(g, { type: "buildSettlement", vertex: v }, rng).ok).toBe(false);
  });

  it("upgrades your settlement to a city, returning the settlement piece", () => {
    const g = mainGame();
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 };
    const r = apply(g, { type: "buildCity", vertex: v }, rng);
    expectOk(r);
    expect(r.state.board.buildings[v]).toEqual({ owner: 0, type: "city" });
    expect(r.state.players[0]!.victoryPoints).toBe(2);
    expect(r.state.players[0]!.pieces.cities).toBe(3);
    expect(r.state.players[0]!.pieces.settlements).toBe(6);
  });

  it("rejects upgrading another player's settlement", () => {
    const g = mainGame();
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 1, type: "settlement" };
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 };
    expect(apply(g, { type: "buildCity", vertex: v }, rng).ok).toBe(false);
  });

  it("requires rolling before building", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 };
    expect(apply(g, { type: "buildCity", vertex: v }, rng).ok).toBe(false);
  });

  it("rejects building without enough resources", () => {
    const g = mainGame();
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    expect(apply(g, { type: "buildCity", vertex: v }, rng).ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
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

describe("bank/port trading", () => {
  it("4:1 default trade (no port access)", () => {
    const g = mainGame();
    // Clear all buildings so player 0 owns no port vertex
    g.board.buildings = {};
    // Clear ports to be explicit about no port access
    g.board.ports = [];
    g.players[0]!.resources.wood = 4;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 4);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("3:1 generic port reduces trade ratio to 3", () => {
    const g = mainGame();
    // Pick two vertex IDs for the port
    const [v, v2] = topology().vertexIds;
    // Set up a controlled "any" port deterministically
    g.board.ports = [{ edge: "x", vertices: [v!, v2!], kind: "any" }];
    // Player 0 has a settlement on the port vertex
    g.board.buildings = {};
    g.board.buildings[v!] = { owner: 0, type: "settlement" };
    g.players[0]!.resources.wood = 3;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 3);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("2:1 matching port reduces trade ratio to 2", () => {
    const g = mainGame();
    // Pick two vertex IDs for the port
    const [v, v2] = topology().vertexIds;
    // Set up a controlled 2:1 wood port deterministically
    g.board.ports = [{ edge: "x", vertices: [v!, v2!], kind: "wood" }];
    g.board.buildings = {};
    g.board.buildings[v!] = { owner: 0, type: "settlement" };
    g.players[0]!.resources.wood = 2;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 2);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("rejects when player has fewer resources than the required ratio", () => {
    const g = mainGame();
    g.board.buildings = {};
    g.board.ports = [];
    g.players[0]!.resources.wood = 3; // 4:1 required, only 3 available

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when bank has none of the requested resource", () => {
    const g = mainGame();
    g.board.buildings = {};
    g.board.ports = [];
    g.players[0]!.resources.wood = 4;
    g.bank.brick = 0;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects trading a resource for itself", () => {
    const g = mainGame();
    g.players[0]!.resources.wood = 4;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "wood" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when not in main subPhase (awaiting roll)", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    g.players[0]!.resources.wood = 4;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { makeDevDeck } from "../../src/engine/devcards";
import { apply } from "../../src/engine/apply";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";
import { recomputeVictoryPoints } from "../../src/engine/scoring/victory";
import { topology } from "../../src/engine/board";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

describe("dev deck", () => {
  it("makeDevDeck has the 25 standard cards", () => {
    const deck = makeDevDeck();
    expect(deck).toHaveLength(25);
    const count = (t: string) => deck.filter((c) => c === t).length;
    expect(count("knight")).toBe(14);
    expect(count("victoryPoint")).toBe(5);
    expect(count("roadBuilding")).toBe(2);
    expect(count("yearOfPlenty")).toBe(2);
    expect(count("monopoly")).toBe(2);
  });

  it("a new game seeds the deck and gives every player an empty dev-card hand", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
    expect(g.devDeck).toHaveLength(25);
    for (const p of g.players) expect(p.devCards).toEqual([]);
  });
});

function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}

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

describe("buyDevCard", () => {
  it("pays ore+wheat+sheep, draws one card, and shrinks the deck", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(r);
    expect(r.state.players[0]!.devCards).toHaveLength(1);
    expect(r.state.players[0]!.devCards[0]!.boughtThisTurn).toBe(true);
    expect(r.state.devDeck).toHaveLength(24);
    expect(r.state.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    expect(r.state.bank.sheep).toBe(20); // bank started at 19, +1 returned
  });

  it("rejects buying without enough resources", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 1 };
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });

  it("rejects buying when the deck is empty", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = [];
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });

  it("rejects buying before rolling (not main sub-phase)", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.turn.subPhase = "awaitingRoll";
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });
});

describe("victory-point dev cards", () => {
  it("a held VP card adds 1 to recomputed victory points", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "victoryPoint", boughtThisTurn: true, played: false });
    recomputeVictoryPoints(g, 0);
    expect(g.players[0]!.victoryPoints).toBe(1); // 0 buildings + 1 VP card
  });

  it("buying the final VP card wins the game at 9 building VP", () => {
    const g = mainGame();
    // 9 VP of buildings placed directly (bypassing distance/network — fine for a scoring test):
    // 4 cities (8) + 1 settlement (1).
    const verts = topology().vertexIds.slice(0, 5);
    verts.slice(0, 4).forEach((v) => (g.board.buildings[v] = { owner: 0, type: "city" }));
    g.board.buildings[verts[4]!] = { owner: 0, type: "settlement" };
    recomputeVictoryPoints(g, 0);
    expect(g.players[0]!.victoryPoints).toBe(9);

    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = ["victoryPoint"];
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(r);
    expect(r.state.players[0]!.victoryPoints).toBe(10);
    expect(r.state.phase).toBe("finished");
    expect(r.state.winner).toBe(0);
  });
});

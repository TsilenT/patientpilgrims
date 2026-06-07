import { describe, it, expect } from "vitest";
import { currentActor, opponentView } from "../../src/state/viewModel";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 1, subPhase: "main" }; delete g.setup;
  return g;
}

describe("currentActor", () => {
  it("is the active seat when no discards are owed", () => {
    expect(currentActor(mainGame())).toBe(1);
  });
  it("is the lowest owing seat while discards are pending", () => {
    const g = mainGame(); g.discardObligations = { 2: 4, 0: 3 };
    expect(currentActor(g)).toBe(0);
  });
});

describe("opponentView", () => {
  it("exposes only counts, not the resource breakdown", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 0 };
    g.players[0]!.devCards = [{ type: "knight", boughtThisTurn: false, played: false }];
    const view = opponentView(g, 0);
    expect(view.resourceCount).toBe(3);
    expect(view.devCardCount).toBe(1);
    expect((view as unknown as Record<string, unknown>).resources).toBeUndefined();
  });

  it("shows an opponent's public victory points during play", () => {
    const g = mainGame();
    g.players[1]!.victoryPoints = 5;
    g.players[1]!.devCards = [{ type: "victoryPoint", boughtThisTurn: false, played: false }];

    expect(opponentView(g, 1).victoryPoints).toBe(5);
  });

  it("reveals an opponent's full victory points when finished", () => {
    const g = mainGame();
    g.phase = "finished";
    g.winner = 1;
    g.players[1]!.victoryPoints = 5;
    g.players[1]!.devCards = [{ type: "victoryPoint", boughtThisTurn: false, played: false }];

    expect(opponentView(g, 1).victoryPoints).toBe(6);
  });
});

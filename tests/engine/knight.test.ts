import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import type { GameState } from "../../src/engine/types";
import { recomputeVictoryPoints } from "../../src/engine/scoring/victory";

const players3 = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
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

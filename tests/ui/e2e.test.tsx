// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32, recomputeVictoryPoints } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

// End-to-end through the store: a near-win state where buying the last dev card
// (a victory point) crosses 10 VP, runs checkVictory in apply, and the UI shows
// the winner. Mirrors the engine scenario test at the UI boundary.
test("a winning action dispatched through the store shows the game-over banner", () => {
  const g: GameState = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;

  // Seat 0 holds 9 building VP (4 cities + 1 settlement on distinct vertices).
  const v = topology().vertexIds;
  for (const i of [0, 2, 4, 6]) g.board.buildings[v[i]!] = { owner: 0, type: "city" };
  g.board.buildings[v[8]!] = { owner: 0, type: "settlement" };
  recomputeVictoryPoints(g, 0);
  expect(g.players[0]!.victoryPoints).toBe(9);

  // The dev deck yields a victory-point card; seat 0 can afford one dev card.
  g.devDeck = ["victoryPoint"];
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };

  const store = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const r = store.dispatch({ type: "buyDevCard" }); // draws the VP card → 10 VP → win
  expect(r.ok).toBe(true);
  expect(store.getState().phase).toBe("finished");
  expect(store.getState().winner).toBe(0);

  render(<GameProvider store={store}><GameView /></GameProvider>);
  expect(screen.getByText(/A wins/i)).toBeInTheDocument();
});

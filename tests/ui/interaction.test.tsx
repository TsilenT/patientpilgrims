// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32, topology } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { legalTargets } from "../../src/state/legalTargets";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

function newGame() {
  return createInitialGame(players3, createBoard({ mode: "beginner" }));
}

test("clicking a legal setup vertex dispatches setupSettlement", async () => {
  const g = newGame();
  const store = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  const { container } = render(<GameProvider store={store}><GameView /></GameProvider>);
  const legalV = [...legalTargets(g).vertices][0]!;
  const slot = container.querySelector(`[data-vertex-slot="${legalV}"]`)!;
  await userEvent.click(slot);
  expect(store.getState().board.buildings[legalV]).toEqual({ owner: g.turn.activeSeat, type: "settlement" });
});

test("selecting City then tapping your settlement upgrades it to a city", async () => {
  const g = newGame();
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "main" };
  delete g.setup;
  const v = topology().vertexIds[0]!;
  g.board.buildings[v] = { owner: 0, type: "settlement" };
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 };

  const store = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  const { container } = render(<GameProvider store={store}><GameView /></GameProvider>);
  // conscious build: choose City first, then tap the settlement's (now enlarged) target
  await userEvent.click(screen.getByRole("button", { name: /city/i }));
  const slot = container.querySelector(`[data-vertex-slot="${v}"]`)!;
  expect(slot).not.toBeNull();

  await userEvent.click(slot);

  expect(store.getState().board.buildings[v]).toEqual({ owner: 0, type: "city" });
});

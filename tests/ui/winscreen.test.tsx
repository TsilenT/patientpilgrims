// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import type { GameState } from "../../src/engine/types";

function finishedGame(): GameState {
  const g = createInitialGame(
    [{ name: "Alice", color: "red" }, { name: "Bob", color: "blue" }, { name: "Carol", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "finished";
  g.winner = 0;
  g.turn = { activeSeat: 0, subPhase: "main" };
  delete g.setup;
  g.players[0]!.victoryPoints = 10;
  g.players[1]!.victoryPoints = 7;
  g.players[2]!.victoryPoints = 5;
  g.players[1]!.knightsPlayed = 3;
  return g;
}

function renderFinished() {
  const store = new GameStore(finishedGame(), new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={store}><GameView /></GameProvider>);
}

test("crowns the winner and lists every player with VP and court title", () => {
  renderFinished();
  const dialog = screen.getByRole("dialog", { name: /game over/i });
  expect(dialog).toHaveTextContent("Long live Alice!");
  expect(dialog).toHaveTextContent("Sovereign of Catan · 10 victory points");
  expect(dialog).toHaveTextContent("Lord Commander of the Army");
  expect(dialog).toHaveTextContent("Carol");
  expect(dialog).toHaveTextContent("Court Jester");
});

test("view the realm dismisses the screen and the results pill reopens it", async () => {
  renderFinished();
  await userEvent.click(screen.getByRole("button", { name: /view the realm/i }));
  expect(screen.queryByRole("dialog", { name: /game over/i })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /results/i }));
  expect(screen.getByRole("dialog", { name: /game over/i })).toBeInTheDocument();
});

test("new game clears the hotseat save and navigates to the start screen", async () => {
  localStorage.setItem("adultingcatan:game", JSON.stringify(finishedGame()));
  renderFinished();
  await userEvent.click(screen.getByRole("button", { name: /new game/i }));
  expect(localStorage.getItem("adultingcatan:game")).toBeNull();
  expect(location.hash).toBe("#/");
});

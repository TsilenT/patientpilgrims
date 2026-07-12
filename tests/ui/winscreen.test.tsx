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

function finishedGame(overrides: Partial<GameState> = {}): GameState {
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
  return { ...g, ...overrides };
}

function renderFinished(state: GameState = finishedGame()) {
  const store = new GameStore(state, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={store}><GameView /></GameProvider>);
}

test("crowns the winner and lists every player with VP and court title", () => {
  renderFinished();
  const dialog = screen.getByRole("dialog", { name: /game over/i });
  expect(dialog).toHaveTextContent("Long live Alice!");
  expect(dialog).toHaveTextContent("Sovereign of the Realm · 10 victory points");
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

test("back to menu clears the hotseat save and navigates to the start screen", async () => {
  localStorage.setItem("adultingcatan:game", JSON.stringify(finishedGame()));
  renderFinished();
  await userEvent.click(screen.getByRole("button", { name: /back to menu/i }));
  expect(localStorage.getItem("adultingcatan:game")).toBeNull();
  expect(location.hash).toBe("#/");
});

test("shows dice roll stats in a separate tab and excludes turn-order rolls", async () => {
  renderFinished(finishedGame({
    log: [
      { type: "orderRoll", seat: 0, dice: [6, 6], sum: 12, round: 1 },
      { type: "orderRoll", seat: 1, dice: [1, 1], sum: 2, round: 1 },
      { type: "roll", seat: 0, dice: [3, 4], sum: 7 },
      { type: "roll", seat: 1, dice: [3, 4], sum: 7 },
      { type: "roll", seat: 2, dice: [4, 4], sum: 8 },
    ],
  }));

  expect(screen.getByRole("button", { name: /results section: standings/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Dice roll stats")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: /results section: standings/i }));
  expect(screen.getByRole("listbox", { name: /results section/i })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("option", { name: /dice stats/i }));

  expect(screen.getByRole("button", { name: /results section: dice stats/i })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("region", { name: /dice stats/i })).toHaveTextContent("3 turn rolls");
  expect(screen.getByLabelText("7: 2 rolls, 67%")).toBeInTheDocument();
  expect(screen.getByLabelText("8: 1 rolls, 33%")).toBeInTheDocument();
  expect(screen.getByLabelText("12: 0 rolls, 0%")).toBeInTheDocument();
  expect(screen.getByLabelText("2: 0 rolls, 0%")).toBeInTheDocument();

  // Histogram fill scales to the most-rolled number (7 → full bar, 8 → half).
  expect(screen.getByLabelText("7: 2 rolls, 67%")).toHaveStyle({ "--fill": "100%" });
  expect(screen.getByLabelText("8: 1 rolls, 33%")).toHaveStyle({ "--fill": "50%" });
  expect(screen.getByLabelText("2: 0 rolls, 0%")).toHaveStyle({ "--fill": "0%" });
});

test("shows per-player robber, discard, and activity totals under Other stats", async () => {
  renderFinished(finishedGame({
    log: [
      { type: "roll", seat: 0, dice: [2, 4], sum: 6, blocked: { 1: 2, 2: 1 } },
      { type: "roll", seat: 1, dice: [3, 4], sum: 7 },
      { type: "steal", seat: 0, victim: 1, resource: "wood" },
      { type: "steal", seat: 0, victim: 2, resource: "brick" },
      { type: "discard", seat: 1, count: 4 },
      { type: "discard", seat: 1, count: 2 },
      { type: "tradeBank", seat: 2, resource: "ore" },
      { type: "buildRoad", seat: 2, edge: "e1" },
    ],
  }));

  await userEvent.click(screen.getByRole("button", { name: /results section: standings/i }));
  await userEvent.click(screen.getByRole("option", { name: /other stats/i }));
  const other = screen.getByRole("region", { name: /other stats/i });
  expect(other).toHaveTextContent("Alice");
  expect(screen.getByRole("row", { name: /alice/i })).toHaveTextContent("2");
  expect(screen.getByRole("row", { name: /bob/i })).toHaveTextContent("6");
  expect(other).toHaveTextContent("Stolen from");
  expect(screen.getByRole("row", { name: /carol/i })).toHaveTextContent("1");
});

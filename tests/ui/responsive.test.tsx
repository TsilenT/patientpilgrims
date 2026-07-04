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

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}

test("the board renders inside a stage container that hosts overlays", () => {
  const s = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  const stage = container.querySelector(".board-stage");
  expect(stage).not.toBeNull();
  expect(stage!.querySelector("svg.board")).not.toBeNull();
});

test("the bottom-sheet tabs switch between hand, trades, and log", async () => {
  const s = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);

  // Default tab is Hand → the player's hand (name) is shown.
  expect(screen.getByRole("tab", { name: "Hand" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  expect(screen.getByRole("button", { name: /^propose$/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Bank" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Log" }));
  expect(screen.getByLabelText("Game log")).toBeInTheDocument();
});

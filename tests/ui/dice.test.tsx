// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { DiceSummary } from "../../src/ui/panels/DiceSummary";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import type { GameState } from "../../src/engine/types";

function game(dice?: [number, number]): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "main", ...(dice ? { dice } : {}) };
  delete g.setup;
  return g;
}
const store = (g: GameState) => new GameStore(g, new LocalStoragePersistence(), mulberry32(0));

test("shows the roll total as the readout", () => {
  render(<GameProvider store={store(game([3, 5]))}><DiceSummary /></GameProvider>);
  expect(screen.getByRole("status", { name: /dice roll/i })).toHaveTextContent("8");
});

test("renders a pip die for each value of the roll", () => {
  render(<GameProvider store={store(game([2, 6]))}><DiceSummary /></GameProvider>);
  expect(screen.getByTestId("die-0")).toHaveAttribute("data-value", "2");
  expect(screen.getByTestId("die-1")).toHaveAttribute("data-value", "6");
});

test("shows faint placeholder dice before the first roll (reserves height)", () => {
  render(<GameProvider store={store(game(undefined))}><DiceSummary /></GameProvider>);
  // Two faces still render (so the block doesn't grow on the first roll), but as placeholders.
  expect(screen.getByTestId("die-0")).toHaveClass("die--placeholder");
  expect(screen.getByTestId("die-1")).toHaveClass("die--placeholder");
});

// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { ActionBar } from "../../src/ui/panels/ActionBar";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";

function store(sub: "awaitingRoll" | "main") {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: sub }; delete g.setup;
  return new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
}

test("Roll appears in awaitingRoll and rolls the dice", async () => {
  const s = store("awaitingRoll");
  render(<GameProvider store={s}><ActionBar /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /roll/i }));
  expect(s.getState().turn.dice).toBeDefined();
});

test("End Turn appears in main and advances the active seat", async () => {
  const s = store("main");
  render(<GameProvider store={s}><ActionBar /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /end turn/i }));
  expect(s.getState().turn.activeSeat).toBe(1);
});

test("shows the current turn dice roll outside the log", () => {
  const s = store("main");
  s.getState().turn.dice = [3, 5];
  render(<GameProvider store={s}><ActionBar /></GameProvider>);
  expect(screen.getByRole("status", { name: /dice roll/i })).toHaveTextContent("3 + 5 = 8");
});

test("main action buttons explain their costs", () => {
  const s = store("main");
  render(<GameProvider store={s}><ActionBar /></GameProvider>);
  expect(screen.getByRole("button", { name: /buy dev card/i })).toHaveAttribute(
    "title",
    "Costs sheep, wheat, ore",
  );
});

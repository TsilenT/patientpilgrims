// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

test("the bottom sheet is a direct grid child of the game view", () => {
  // The ≥900px layout places the sheet via `.bottom-sheet { grid-area: sheet }`,
  // which only applies to direct children of the `.game-view` grid. A wrapper
  // element here silently breaks the desktop side rail (zero-height panel).
  const s = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  expect(container.querySelector(".game-view > .bottom-sheet")).not.toBeNull();
});

test("the bottom sheet collapses to a hand summary and reopens from a tab", async () => {
  const s = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);

  // Open by default here (jsdom has no matchMedia): the hand panel is visible.
  expect(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /collapse panel/i }));
  expect(screen.queryByRole("heading", { name: "A" })).toBeNull();
  expect(screen.getByLabelText("Hand summary")).toBeInTheDocument();

  // Tapping a tab reopens; tapping the active tab again collapses.
  await userEvent.click(screen.getByRole("tab", { name: "Hand" }));
  expect(screen.getByRole("heading", { name: "A" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Hand" }));
  expect(screen.queryByRole("heading", { name: "A" })).toBeNull();
  expect(screen.getByLabelText("Hand summary")).toBeInTheDocument();
});

test("the sheet panel resizes by dragging the grip and persists the height", () => {
  localStorage.removeItem("adultingcatan:sheetHeight");
  const s = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);

  const grip = screen.getByRole("separator", { name: /resize panel/i });
  const panel = grip.parentElement as HTMLElement;
  const initial = parseInt(panel.style.height, 10);
  expect(initial).toBeGreaterThanOrEqual(160);

  // Drag the grip 100px upward → the panel grows 100px.
  fireEvent.pointerDown(grip, { pointerId: 1, clientY: 500 });
  fireEvent.pointerMove(grip, { pointerId: 1, clientY: 400 });
  fireEvent.pointerUp(grip, { pointerId: 1 });

  expect(panel.style.height).toBe(`${initial + 100}px`);
  expect(localStorage.getItem("adultingcatan:sheetHeight")).toBe(String(initial + 100));
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

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

test("ending the turn gates the next seat behind a pass screen", async () => {
  const g = createInitialGame(
    [{ name: "Alice", color: "red" }, { name: "Bob", color: "blue" }, { name: "Carol", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /end turn/i }));
  expect(screen.getByText(/pass the device to/i)).toHaveTextContent("Bob");
  expect(screen.queryByRole("button", { name: /roll/i })).toBeNull();
  // The sheet stays rendered (constant layout) but must not be interactive.
  expect(container.querySelector(".bottom-sheet")).toHaveAttribute("inert");
  await userEvent.click(screen.getByRole("button", { name: /reveal/i }));
  expect(screen.getByRole("button", { name: /roll/i })).toBeInTheDocument();
  expect(container.querySelector(".bottom-sheet")).not.toHaveAttribute("inert");
});

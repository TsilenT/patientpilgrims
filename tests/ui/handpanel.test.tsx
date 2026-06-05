// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { HandPanel } from "../../src/ui/panels/HandPanel";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";

test("shows the viewing seat's resource counts", () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  g.players[0]!.resources = { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  render(<GameProvider store={s}><HandPanel /></GameProvider>);
  expect(screen.getByText("A")).toBeInTheDocument();
  const wood = screen.getByTestId("res-wood");
  expect(wood).toHaveTextContent("3");
});

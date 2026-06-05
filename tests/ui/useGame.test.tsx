// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider, useGame } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
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
function Probe() {
  const { state, dispatch } = useGame();
  return <button onClick={() => dispatch({ type: "endTurn" })}>seat {state.turn.activeSeat}</button>;
}

test("useGame exposes state and re-renders on dispatch", async () => {
  const store = new GameStore(mainGame(), new LocalStoragePersistence(), mulberry32(1));
  render(<GameProvider store={store}><Probe /></GameProvider>);
  expect(screen.getByRole("button")).toHaveTextContent("seat 0");
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toHaveTextContent("seat 1");
});

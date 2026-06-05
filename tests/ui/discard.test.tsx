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

test("an owing seat must discard exactly the owed count", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  g.players[0]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  g.discardObligations = { 0: 4 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  const confirm = screen.getByRole("button", { name: /^discard$/i });
  expect(confirm).toBeDisabled();
  const addWood = screen.getByTestId("discard-add-wood");
  await userEvent.click(addWood);
  await userEvent.click(addWood);
  await userEvent.click(addWood);
  await userEvent.click(addWood);
  expect(confirm).toBeEnabled();
  await userEvent.click(confirm);
  expect(s.getState().discardObligations).toBeUndefined();
});

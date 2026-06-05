// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { topology } from "../../src/engine/board";

test("clicking a robber hex with one victim steals and returns to main", async () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "movingRobber" }; delete g.setup;
  const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
  const vtx = topology().hexVertices.get(targetHex)![0]!;
  g.board.buildings[vtx] = { owner: 1, type: "settlement" };
  g.players[1]!.resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(container.querySelector(`[data-hex-slot="${targetHex}"]`)!);
  expect(s.getState().board.robber).toBe(targetHex);
  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.resources.wood).toBe(1);
});

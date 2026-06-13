// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

test("playing monopoly takes all of a chosen resource from opponents", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "monopoly", boughtThisTurn: false, played: false }];
  g.players[1]!.resources = { wood: 0, brick: 3, sheep: 0, wheat: 0, ore: 0 };
  g.players[2]!.resources = { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "monopoly" }));
  const modal = screen.getByRole("dialog", { name: /monopoly/i });
  await userEvent.click(within(modal).getByRole("button", { name: "brick" }));
  expect(s.getState().players[0]!.resources.brick).toBe(5);
  expect(s.getState().players[1]!.resources.brick).toBe(0);
});

test("playing a knight enters the robber move phase and counts the knight", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "knight", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "knight" }));
  expect(s.getState().turn.subPhase).toBe("movingRobber");
  expect(s.getState().players[0]!.knightsPlayed).toBe(1);
});

test("a victory-point card is shown as active but not playable", () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "victoryPoint", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  const card = screen.getByTestId("dev-card-victoryPoint-0");
  expect(card).toHaveTextContent("victoryPoint");
  expect(card).toHaveClass("dev-card--active");
  expect(screen.queryByRole("button", { name: "victoryPoint" })).toBeNull();
});

// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";
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

test("playing monopoly takes all of a chosen resource from opponents after confirming", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "monopoly", boughtThisTurn: false, played: false }];
  g.players[1]!.resources = { wood: 0, brick: 3, sheep: 0, wheat: 0, ore: 0 };
  g.players[2]!.resources = { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 };
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Monopoly" }));
  const modal = screen.getByRole("dialog", { name: /monopoly/i });

  // Selecting a resource does not commit until Confirm.
  await userEvent.click(within(modal).getByRole("button", { name: "brick" }));
  expect(s.getState().players[0]!.resources.brick).toBe(0);
  expect(within(modal).getByRole("button", { name: "brick" })).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(within(modal).getByRole("button", { name: /confirm/i }));
  expect(s.getState().players[0]!.resources.brick).toBe(5);
  expect(s.getState().players[1]!.resources.brick).toBe(0);

  await userEvent.click(screen.getByRole("tab", { name: "Log" }));
  expect(screen.getByRole("list", { name: "Game log" })).toHaveTextContent("A played Monopoly targeting brick");
});

test("monopoly is cancelable without consuming the card", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "monopoly", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Monopoly" }));
  const modal = screen.getByRole("dialog", { name: /monopoly/i });
  await userEvent.click(within(modal).getByRole("button", { name: "wood" }));
  await userEvent.click(within(modal).getByRole("button", { name: /cancel/i }));
  expect(screen.queryByRole("dialog", { name: /monopoly/i })).toBeNull();
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(false);
});

test("year of plenty picks two resources, allows removing a pick, and confirms", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "yearOfPlenty", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Year of Plenty" }));
  const modal = screen.getByRole("dialog", { name: /year of plenty/i });

  await userEvent.click(within(modal).getByRole("button", { name: "wood" }));
  await userEvent.click(within(modal).getByRole("button", { name: "brick" }));
  // Change of heart: drop brick, take a second wood instead.
  await userEvent.click(within(modal).getByRole("button", { name: "Remove brick" }));
  await userEvent.click(within(modal).getByRole("button", { name: "wood" }));

  await userEvent.click(within(modal).getByRole("button", { name: /confirm/i }));
  expect(s.getState().players[0]!.resources.wood).toBe(2);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(true);
});

test("year of plenty is cancelable without consuming the card", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "yearOfPlenty", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Year of Plenty" }));
  const modal = screen.getByRole("dialog", { name: /year of plenty/i });
  await userEvent.click(within(modal).getByRole("button", { name: "wood" }));
  await userEvent.click(within(modal).getByRole("button", { name: /cancel/i }));
  expect(screen.queryByRole("dialog", { name: /year of plenty/i })).toBeNull();
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(false);
  expect(s.getState().players[0]!.resources.wood).toBe(0);
});

test("playing a knight is cancelable before committing the robber move", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "knight", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("button", { name: "Knight" }));

  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.knightsPlayed).toBe(0);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(false);
  expect(screen.getByRole("status", { name: /robber placement/i })).toHaveTextContent(/knight: move the robber/i);
  expect(screen.getByRole("status", { name: /robber placement/i })).not.toHaveTextContent(/roll 7/i);

  await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.knightsPlayed).toBe(0);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(false);
  expect(screen.queryByRole("status", { name: /robber placement/i })).toBeNull();
});

test("confirming a knight robber move plays the knight and moves the robber", async () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "knight", boughtThisTurn: false, played: false }];
  const oldRobber = g.board.robber;
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("button", { name: "Knight" }));
  const targetHex = Object.keys(g.board.tiles).find((hex) => hex !== oldRobber)!;
  await userEvent.click(container.querySelector(`[data-hex-slot="${targetHex}"]`)!);
  await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

  expect(s.getState().turn.subPhase).toBe("main");
  expect(s.getState().players[0]!.knightsPlayed).toBe(1);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(true);
  expect(s.getState().board.robber).toBe(targetHex);
});

function roadBuildingGame(): GameState {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "roadBuilding", boughtThisTurn: false, played: false }];
  // A settlement gives seat 0 a network so adjacent edges are legal targets.
  g.board.buildings[topology().vertexIds[0]!] = { owner: 0, type: "settlement" };
  return g;
}

test("road building shows pending roads, supports tap-to-remove, and confirms", async () => {
  const g = roadBuildingGame();
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("button", { name: "Road Building" }));
  expect(screen.getByRole("status", { name: /road building placement/i })).toBeInTheDocument();
  const bar = screen.getByRole("dialog", { name: /road building/i });
  expect(bar).toHaveTextContent("Roads placed: 0/2");
  expect(within(bar).getByRole("button", { name: /confirm/i })).toBeDisabled();

  // Place a road: it renders as a pending road on the board, nothing is committed yet.
  await userEvent.click(container.querySelector("[data-edge-slot]")!);
  expect(bar).toHaveTextContent("Roads placed: 1/2");
  expect(container.querySelector("[data-pending-road]")).not.toBeNull();
  expect(Object.keys(s.getState().board.roads)).toHaveLength(0);

  // Tapping the pending road removes it again.
  await userEvent.click(container.querySelector("[data-pending-road]")!);
  expect(bar).toHaveTextContent("Roads placed: 0/2");
  expect(container.querySelector("[data-pending-road]")).toBeNull();

  // Place two and confirm.
  await userEvent.click(container.querySelector("[data-edge-slot]")!);
  await userEvent.click(container.querySelector("[data-edge-slot]")!);
  expect(bar).toHaveTextContent("Roads placed: 2/2");
  await userEvent.click(within(bar).getByRole("button", { name: /confirm/i }));

  expect(Object.keys(s.getState().board.roads)).toHaveLength(2);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(true);
  expect(screen.queryByRole("dialog", { name: /road building/i })).toBeNull();
});

test("road building is cancelable without consuming the card", async () => {
  const g = roadBuildingGame();
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("button", { name: "Road Building" }));
  await userEvent.click(container.querySelector("[data-edge-slot]")!);
  const bar = screen.getByRole("dialog", { name: /road building/i });
  await userEvent.click(within(bar).getByRole("button", { name: /cancel/i }));

  expect(screen.queryByRole("dialog", { name: /road building/i })).toBeNull();
  expect(container.querySelector("[data-pending-road]")).toBeNull();
  expect(Object.keys(s.getState().board.roads)).toHaveLength(0);
  expect(s.getState().players[0]!.devCards[0]!.played).toBe(false);
});

test("a victory-point card is shown as active but not playable", () => {
  const g = mainGame();
  g.players[0]!.devCards = [{ type: "victoryPoint", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={s}><GameView /></GameProvider>);
  const card = screen.getByTestId("dev-card-victoryPoint-0");
  expect(card).toHaveTextContent("Victory Point");
  expect(card).toHaveClass("dev-card--active");
  expect(screen.queryByRole("button", { name: "Victory Point" })).toBeNull();
});

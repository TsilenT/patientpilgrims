// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { TurnActions } from "../../src/ui/panels/TurnActions";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function store(g: GameState) { return new GameStore(g, new LocalStoragePersistence(), mulberry32(0)); }

test("city button enables when you can afford it and own a settlement", () => {
  const g = mainGame();
  const v = topology().vertexIds[0]!;
  g.board.buildings[v] = { owner: 0, type: "settlement" };
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 }; // exactly a city
  render(
    <GameProvider store={store(g)}>
      <TurnActions buildMode={null} onSelectBuild={() => {}} onCancelBuild={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByRole("button", { name: /city/i })).toBeEnabled();
});

test("road button disabled with no resources / no network", () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  render(
    <GameProvider store={store(g)}>
      <TurnActions buildMode={null} onSelectBuild={() => {}} onCancelBuild={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByRole("button", { name: /road/i })).toBeDisabled();
});

test("placement mode shows a prompt and a cancel button", () => {
  render(
    <GameProvider store={store(mainGame())}>
      <TurnActions buildMode="settlement" onSelectBuild={() => {}} onCancelBuild={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByText(/tap a spot to build a settlement/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});

test("main phase is read-only until a build type is selected", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  const e = topology().edgeIds[0]!;
  g.board.roads[e] = { owner: 0 }; // give seat 0 a network so road would be legal
  const { container } = render(<GameProvider store={store(g)}><GameView /></GameProvider>);
  expect(container.querySelector("[data-edge-slot]")).toBeNull();
  expect(container.querySelector("[data-vertex-slot]")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  expect(screen.getByText(/tap a spot to build a road/i)).toBeInTheDocument();
  expect(container.querySelector("[data-edge-slot]")).not.toBeNull();
});

test("selecting a type, placing, then returning to neutral", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 2, brick: 2, sheep: 0, wheat: 0, ore: 0 };
  const e0 = topology().edgeIds[0]!;
  g.board.roads[e0] = { owner: 0 };
  const { container } = render(<GameProvider store={store(g)}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  const slot = container.querySelector("[data-edge-slot]") as SVGElement;
  await userEvent.click(slot);
  expect(screen.queryByText(/tap a spot to build a road/i)).toBeNull();
  expect(screen.getByRole("button", { name: /road/i })).toBeInTheDocument();
});

test("cancel exits placement without building", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  const e0 = topology().edgeIds[0]!;
  g.board.roads[e0] = { owner: 0 };
  render(<GameProvider store={store(g)}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(screen.queryByText(/tap a spot to build a road/i)).toBeNull();
});

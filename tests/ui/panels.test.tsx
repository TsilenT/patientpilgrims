// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { OpponentBar } from "../../src/ui/panels/OpponentBar";
import { LogRail } from "../../src/ui/panels/LogRail";
import { HandPanel } from "../../src/ui/panels/HandPanel";
import { GameOverBanner } from "../../src/ui/overlays/GameOverBanner";
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
function store(g: GameState) {
  return new GameStore(g, new LocalStoragePersistence(), mulberry32(0));
}

test("opponent bar shows counts for non-viewing seats only", () => {
  const g = mainGame();
  g.players[1]!.resources = { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  render(<GameProvider store={store(g)}><OpponentBar /></GameProvider>);
  // viewer is seat 0 (active) → not shown; opponents 1 and 2 are
  expect(screen.getByTestId("opp-1-resources")).toHaveTextContent("3");
  expect(screen.queryByTestId("opp-0-resources")).toBeNull();
  expect(screen.getByTestId("opp-2-resources")).toBeInTheDocument();
});

test("log rail renders readable event lines", () => {
  const g = mainGame();
  g.log = [{ type: "roll", seat: 0, sum: 8 }, { type: "buildCity", seat: 1 }];
  render(<GameProvider store={store(g)}><LogRail /></GameProvider>);
  expect(screen.getByText("A rolled 8")).toBeInTheDocument();
  expect(screen.getByText("B built a city")).toBeInTheDocument();
});

test("hand panel includes a build cost reference", () => {
  render(<GameProvider store={store(mainGame())}><HandPanel /></GameProvider>);
  const costs = screen.getByRole("region", { name: /cost reference/i });
  expect(costs).toHaveTextContent("Road");
  expect(costs).toHaveTextContent("wood + brick");
  expect(costs).toHaveTextContent("Settlement");
  expect(costs).toHaveTextContent("wood + brick + sheep + wheat");
  expect(costs).toHaveTextContent("City upgrade");
  expect(costs).toHaveTextContent("2 wheat + 3 ore");
  expect(costs).toHaveTextContent("Dev card");
  expect(costs).toHaveTextContent("sheep + wheat + ore");
});

test("cost reference rows expose tooltip details", () => {
  render(<GameProvider store={store(mainGame())}><HandPanel /></GameProvider>);
  expect(screen.getByText("City upgrade").closest("li")).toHaveAttribute(
    "title",
    "Upgrade one settlement to a city. Costs 2 wheat, 3 ore.",
  );
});

test("game over banner names the winner when finished", () => {
  const g = mainGame();
  g.phase = "finished"; g.winner = 1;
  render(<GameProvider store={store(g)}><GameOverBanner /></GameProvider>);
  expect(screen.getByText(/B wins/i)).toBeInTheDocument();
});

test("game over banner renders nothing during play", () => {
  const { container } = render(<GameProvider store={store(mainGame())}><GameOverBanner /></GameProvider>);
  expect(container).toBeEmptyDOMElement();
});

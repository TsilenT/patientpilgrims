// @vitest-environment jsdom
import { test, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { OpponentBar } from "../../src/ui/panels/OpponentBar";
import { LogRail } from "../../src/ui/panels/LogRail";
import { HandPanel } from "../../src/ui/panels/HandPanel";
import { WinScreen } from "../../src/ui/overlays/WinScreen";
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

test("opponent bar shows icon stats with tooltips", () => {
  const g = mainGame();
  g.players[1]!.resources = { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  g.players[1]!.devCards = [
    { type: "knight", boughtThisTurn: false, played: false },
    { type: "monopoly", boughtThisTurn: false, played: true },
  ];
  render(<GameProvider store={store(g)}><OpponentBar /></GameProvider>);
  expect(screen.getByTestId("opp-1-resources")).toHaveTextContent("3");
  expect(screen.getByTestId("opp-1-resources")).toHaveAttribute("title", "Resource cards");
  expect(screen.getByTestId("opp-1-dev")).toHaveTextContent("1");
  expect(screen.getByTestId("opp-1-dev")).toHaveAttribute("title", "Development cards");
  expect(screen.getByTestId("opp-1-vp")).toHaveTextContent("0");
});

test("opponent bar highlights the knight stat for the Largest Army holder", () => {
  const g = mainGame();
  g.players[1]!.knightsPlayed = 3;
  g.awards.largestArmy = 1;
  render(<GameProvider store={store(g)}><OpponentBar /></GameProvider>);
  const knightStat = screen.getByTitle("Largest Army (3+ knights)");
  expect(knightStat).toHaveClass("is-award");
  expect(knightStat).toHaveTextContent("3");
  // seat 2 holds no army → its knight stat is the plain "Knights played" variant
  expect(screen.getByTitle("Knights played")).not.toHaveClass("is-award");
});

test("log rail renders the full log newest first", () => {
  const g = mainGame();
  g.log = [
    { type: "roll", seat: 0, sum: 2 },
    { type: "roll", seat: 0, sum: 3 },
    { type: "roll", seat: 0, sum: 4 },
    { type: "roll", seat: 0, sum: 5 },
    { type: "roll", seat: 0, sum: 6 },
    { type: "roll", seat: 0, sum: 7 },
    { type: "roll", seat: 0, sum: 8 },
    { type: "roll", seat: 0, sum: 9 },
    { type: "roll", seat: 0, sum: 10 },
    { type: "roll", seat: 0, sum: 11 },
    { type: "roll", seat: 0, sum: 12 },
    { type: "buildRoad", seat: 1 },
    { type: "buildSettlement", seat: 2 },
    { type: "tradeBank", seat: 0 },
    { type: "buyDevCard", seat: 1 },
    { type: "buildCity", seat: 2 },
  ];
  render(<GameProvider store={store(g)}><LogRail /></GameProvider>);

  const lines = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(lines).toEqual([
    "C built a city",
    "B bought a development card",
    "A traded with the bank",
    "C built a settlement",
    "B built a road",
    "A rolled 12",
    "A rolled 11",
    "A rolled 10",
    "A rolled 9",
    "A rolled 8",
    "A rolled 7",
    "A rolled 6",
    "A rolled 5",
    "A rolled 4",
    "A rolled 3",
    "A rolled 2",
  ]);
});

test("log rail inserts new entries at the top without changing scroll position", () => {
  const g = mainGame();
  g.log = [{ type: "roll", seat: 0, sum: 8 }];
  const s = store(g);
  render(<GameProvider store={s}><LogRail /></GameProvider>);
  const rail = screen.getByLabelText("Game log");
  rail.scrollTop = 40;

  act(() => {
    s.dispatch({ type: "endTurn" });
  });

  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("A ended their turn");
  expect(rail.scrollTop).toBe(40);
});

test("log rail names the robber steal victim", () => {
  const g = mainGame();
  g.log = [{ type: "steal", seat: 0, victim: 1, resource: "wood" }];

  render(<GameProvider store={store(g)}><LogRail /></GameProvider>);

  expect(screen.getByRole("listitem")).toHaveTextContent("A stole a card from B");
});

test("hand panel includes a build cost reference with resource tiles", () => {
  render(<GameProvider store={store(mainGame())}><HandPanel /></GameProvider>);
  const costs = screen.getByRole("region", { name: /cost reference/i });
  for (const label of ["Road (15 left)", "Settlement (5 left)", "City Upgrade (4 left)", "Dev Card (25 left)"]) {
    expect(costs).toHaveTextContent(label);
  }
  const road = screen.getByText("Road (15 left)").closest("li")!;
  expect(road.querySelectorAll('.res-tile[data-res="wood"]')).toHaveLength(1);
  expect(road.querySelectorAll('.res-tile[data-res="brick"]')).toHaveLength(1);
  const city = screen.getByText("City Upgrade (4 left)").closest("li")!;
  expect(city.querySelectorAll('.res-tile[data-res="wheat"]')).toHaveLength(2);
  expect(city.querySelectorAll('.res-tile[data-res="ore"]')).toHaveLength(3);
});

test("cost reference rows expose tooltip details", () => {
  render(<GameProvider store={store(mainGame())}><HandPanel /></GameProvider>);
  expect(screen.getByText("City Upgrade (4 left)").closest("li")).toHaveAttribute(
    "title",
    "Upgrade one settlement to a city. Costs 2 wheat, 3 ore.",
  );
});

test("win screen crowns the winner when finished", () => {
  const g = mainGame();
  g.phase = "finished"; g.winner = 1;
  render(<GameProvider store={store(g)}><WinScreen /></GameProvider>);
  expect(screen.getByText(/long live B/i)).toBeInTheDocument();
});

test("win screen renders nothing during play", () => {
  const { container } = render(<GameProvider store={store(mainGame())}><WinScreen /></GameProvider>);
  expect(container).toBeEmptyDOMElement();
});

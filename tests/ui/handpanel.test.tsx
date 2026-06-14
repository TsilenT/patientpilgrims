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

test("shows own true VP with hidden victory-point card breakdown", () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  g.players[0]!.victoryPoints = 5;
  g.players[0]!.devCards = [{ type: "victoryPoint", boughtThisTurn: false, played: false }];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  render(<GameProvider store={s}><HandPanel /></GameProvider>);

  const summary = screen.getByTestId("hand-vp-summary");
  expect(summary).toHaveAccessibleName("Victory points");
  expect(summary).toHaveClass("vp-pill");
  expect(summary).toHaveTextContent("6"); // total VP (5 public + 1 hidden), shown in the pill
  // The long breakdown moved to a hover title instead of inline text.
  expect(summary).toHaveAttribute("title", "5 public + 1 from victory-point cards");
});

test("splits development cards into hand and played sections with blocked cards grayed", () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "main", devCardPlayedThisTurn: true };
  delete g.setup;
  g.players[0]!.devCards = [
    { type: "knight", boughtThisTurn: false, played: false },
    { type: "victoryPoint", boughtThisTurn: false, played: false },
    { type: "monopoly", boughtThisTurn: false, played: true },
  ];
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
  render(<GameProvider store={s}><HandPanel onPlayDev={() => undefined} /></GameProvider>);

  const hand = screen.getByRole("list", { name: "Development hand" });
  const played = screen.getByRole("list", { name: "Played development cards" });

  expect(hand).toHaveTextContent("Knight");
  expect(hand).toHaveTextContent("Victory Point");
  expect(played).toHaveTextContent("Monopoly");
  expect(screen.getByTestId("dev-card-knight-0")).toHaveClass("dev-card--blocked");
  expect(screen.getByTestId("dev-card-victoryPoint-1")).toHaveClass("dev-card--active");
  expect(screen.getByTestId("dev-card-monopoly-2")).toHaveClass("dev-card--played");
});

test("cost reference shows capitalized item names and remaining stock", () => {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  g.players[0]!.pieces = { roads: 8, settlements: 3, cities: 2 };
  g.devDeck = g.devDeck.slice(0, 17);
  const s = new GameStore(g, new LocalStoragePersistence(), mulberry32(1));

  render(<GameProvider store={s}><HandPanel /></GameProvider>);

  const costs = screen.getByRole("region", { name: "Cost reference" });
  expect(costs).toHaveTextContent("Road (8 left)");
  expect(costs).toHaveTextContent("Settlement (3 left)");
  expect(costs).toHaveTextContent("City Upgrade (2 left)");
  expect(costs).toHaveTextContent("Dev Card (17 left)");
});

// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { TurnActions } from "../../src/ui/panels/TurnActions";
import { DiceSummary } from "../../src/ui/panels/DiceSummary";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";

function store(sub: "awaitingRoll" | "main") {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: sub }; delete g.setup;
  return new GameStore(g, new LocalStoragePersistence(), mulberry32(1));
}

const noop = () => {};
function renderActions(s: GameStore, buildMode: "road" | "settlement" | "city" | null = null) {
  return render(
    <GameProvider store={s}>
      <TurnActions buildMode={buildMode} onSelectBuild={noop} onCancelBuild={noop} />
    </GameProvider>,
  );
}

test("Roll is the primary before rolling, then morphs into End Turn", async () => {
  const s = store("awaitingRoll");
  renderActions(s);
  expect(screen.queryByRole("button", { name: /end turn/i })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /roll/i }));
  expect(s.getState().turn.dice).toBeDefined();
  expect(screen.getByRole("button", { name: /end turn/i })).toBeInTheDocument();
});

test("End Turn replaces Roll after rolling and advances the seat", async () => {
  const s = store("main");
  renderActions(s);
  expect(screen.queryByRole("button", { name: /^roll$/i })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /end turn/i }));
  expect(s.getState().turn.activeSeat).toBe(1);
});

test("purchase chips are visible but disabled before the roll", () => {
  const s = store("awaitingRoll");
  s.getState().players[0]!.resources = { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 1 };
  renderActions(s);
  const road = screen.getByRole("button", { name: /road/i });
  expect(road).toBeDisabled();
  expect(road).toHaveAttribute("title", "Roll the dice first");
});

test("the dev card chip shows the deck count and buys a card", async () => {
  const s = store("main");
  s.getState().players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
  renderActions(s);
  const chip = screen.getByRole("button", { name: "Dev Card" });
  expect(chip).toBeEnabled();
  expect(chip).toHaveTextContent("25"); // full deck
  await userEvent.click(chip);
  expect(s.getState().players[0]!.devCards).toHaveLength(1);
});

test("the dev card chip is disabled when unaffordable", () => {
  const s = store("main");
  s.getState().players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  renderActions(s);
  expect(screen.getByRole("button", { name: "Dev Card" })).toBeDisabled();
});

test("build chips carry their resource costs as tiles", () => {
  const s = store("main");
  const { container } = renderActions(s);
  const road = screen.getByRole("button", { name: /road/i });
  expect(road.querySelectorAll(".res-tile")).toHaveLength(2); // wood + brick
  const city = screen.getByRole("button", { name: /city/i });
  expect(city.querySelectorAll(".res-tile")).toHaveLength(5); // 2 wheat + 3 ore
  expect(container.querySelectorAll(".chip")).toHaveLength(4);
});

test("an active build mode swaps to the placement prompt", async () => {
  const s = store("main");
  const onCancel = vi.fn();
  render(
    <GameProvider store={s}>
      <TurnActions buildMode="settlement" onSelectBuild={noop} onCancelBuild={onCancel} />
    </GameProvider>,
  );
  expect(screen.getByText(/tap a spot to build a settlement/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalled();
});

test("DiceSummary shows the current turn dice roll", () => {
  const s = store("main");
  s.getState().turn.dice = [3, 5];
  render(<GameProvider store={s}><DiceSummary /></GameProvider>);
  expect(screen.getByTestId("die-0")).toHaveAttribute("data-value", "3");
  expect(screen.getByTestId("die-1")).toHaveAttribute("data-value", "5");
  expect(screen.getByRole("status", { name: /dice roll/i })).toHaveTextContent("8");
});

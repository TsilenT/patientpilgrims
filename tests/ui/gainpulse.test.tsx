// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { HandPanel } from "../../src/ui/panels/HandPanel";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";
import type { Store } from "../../src/state/store";

function baseGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}

function controllable(initial: GameState, seat: number) {
  let s = initial;
  const ls = new Set<() => void>();
  const store: Store = {
    getState: () => s,
    subscribe: (cb) => { ls.add(cb); return () => ls.delete(cb); },
    dispatch: () => ({ ok: true }),
    seat: () => seat,
  };
  const push = (next: GameState) => { s = next; act(() => ls.forEach((l) => l())); };
  return { store, push };
}

test("flashes +N on each resource you gained when a roll lands", () => {
  const { store, push } = controllable(baseGame(), 0);
  render(<GameProvider store={store}><HandPanel /></GameProvider>);
  expect(screen.queryByTestId("gain-wood")).toBeNull();

  const next = structuredClone(store.getState());
  next.players[0]!.resources.wood += 2;
  next.players[0]!.resources.sheep += 1;
  next.log.push({ type: "roll", seat: 1, dice: [2, 3], sum: 5, gains: { 0: { wood: 2, sheep: 1 } } });
  push(next);

  expect(screen.getByTestId("gain-wood")).toHaveTextContent("+2");
  expect(screen.getByTestId("gain-sheep")).toHaveTextContent("+1");
  expect(screen.getByTestId("res-wood")).toHaveClass("res-chip--gain");
  expect(screen.queryByTestId("gain-brick")).toBeNull(); // didn't gain brick
});

test("does not flash when the roll produced for someone else", () => {
  const { store, push } = controllable(baseGame(), 0);
  render(<GameProvider store={store}><HandPanel /></GameProvider>);

  const next = structuredClone(store.getState());
  next.log.push({ type: "roll", seat: 1, dice: [2, 3], sum: 5, gains: { 1: { wood: 2 } } });
  push(next);

  expect(screen.queryByTestId("gain-wood")).toBeNull();
});

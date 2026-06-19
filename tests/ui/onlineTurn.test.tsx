// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32, apply } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";
import type { Store, DispatchResult } from "../../src/state/store";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "Alice", color: "red" }, { name: "Bob", color: "blue" }, { name: "Carol", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "awaitingRoll" }; delete g.setup;
  return g;
}

/** Minimal online store: like the real one, it reports which seat this device owns. */
function onlineStore(initial: GameState, mySeat: number): Store {
  let s = initial;
  const ls = new Set<() => void>();
  return {
    getState: () => s,
    subscribe: (cb) => { ls.add(cb); return () => { ls.delete(cb); }; },
    dispatch: (a): DispatchResult => {
      const r = apply(s, a, mulberry32(0));
      if (!r.ok) return { ok: false, error: r.error };
      s = r.state; ls.forEach((l) => l()); return { ok: true };
    },
    seat: () => mySeat,
  };
}

test("online: on your turn the controls are interactive", () => {
  render(<GameProvider store={onlineStore(mainGame(), 0)}><GameView /></GameProvider>);
  expect(screen.getByRole("button", { name: /roll/i })).toBeInTheDocument();
  expect(screen.queryByText(/waiting for/i)).toBeNull();
});

test("online: when it is not your turn you see a read-only waiting view", () => {
  render(<GameProvider store={onlineStore(mainGame(), 1)}><GameView /></GameProvider>);
  const banner = screen.getByText(/waiting for/i);
  expect(banner).toHaveTextContent("Waiting for Alice…");
  expect(banner.textContent).not.toContain("forAlice");
  expect(banner.childNodes[0]?.textContent).toBe("Waiting for Alice…");
  expect(screen.queryByRole("button", { name: /roll/i })).toBeNull();
  // Hand stays left of the always-available Trades tab and Log.
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Your hand", "Trades", "Log"]);
});

test("online: dice summary remains visible while waiting for another player", () => {
  const g = mainGame();
  g.turn = { activeSeat: 0, subPhase: "main", dice: [4, 6] };
  render(<GameProvider store={onlineStore(g, 1)}><GameView /></GameProvider>);
  const dice = screen.getByRole("status", { name: /dice roll/i });
  expect(dice).toHaveTextContent("10");
  expect(dice).toHaveClass("dice-summary");
  expect(dice.closest(".top-hud")).not.toBeNull();
});

test("online: waiting players can view trades but only accept as themselves", async () => {
  const g = mainGame();
  g.turn = { activeSeat: 0, subPhase: "main", dice: [4, 6] };
  g.tradeOffers = [{ id: 0, from: 0, give: { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 }, want: { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 0 } }];
  render(<GameProvider store={onlineStore(g, 1)}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: /^Trades/ }));

  expect(screen.getByTestId("accept-0-1")).toBeInTheDocument();
  expect(screen.queryByTestId("accept-0-2")).toBeNull();
});

test("online: you can resolve your own discard even when it is not your turn", () => {
  const g = mainGame();
  g.turn = { activeSeat: 0, subPhase: "movingRobber", robberReturn: "main" };
  g.discardObligations = { 1: 2 };
  g.players[1]!.resources = { wood: 2, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  render(<GameProvider store={onlineStore(g, 1)}><GameView /></GameProvider>);
  expect(screen.getByRole("dialog", { name: /discard cards/i })).toBeInTheDocument();
  expect(screen.queryByText(/waiting for/i)).toBeNull();
});

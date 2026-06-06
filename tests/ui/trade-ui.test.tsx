// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { TradePanel } from "../../src/ui/panels/TradePanel";
import { createInitialGame, mulberry32, apply } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import type { GameState, ResourceMap } from "../../src/engine/types";
import type { Store, DispatchResult } from "../../src/state/store";

const rm = (wood = 0, brick = 0, sheep = 0, wheat = 0, ore = 0): ResourceMap =>
  ({ wood, brick, sheep, wheat, ore });

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

function onlineStore(initial: GameState, mySeat: number): Store {
  let s = initial;
  const ls = new Set<() => void>();
  return {
    getState: () => s,
    subscribe: (cb) => { ls.add(cb); return () => { ls.delete(cb); }; },
    dispatch: (a): DispatchResult => {
      const r = apply(s, a, mulberry32(0));
      if (!r.ok) return { ok: false, error: r.error };
      s = r.state;
      ls.forEach((l) => l());
      return { ok: true };
    },
    seat: () => mySeat,
  };
}

test("bank trade swaps at the 4:1 default ratio", async () => {
  const g = mainGame();
  g.players[0]!.resources = rm(4); // 4 wood
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByRole("button", { name: /trade with bank/i }));
  expect(s.getState().players[0]!.resources.wood).toBe(0);
  expect(s.getState().players[0]!.resources.brick).toBe(1);
});

test("propose then accept-on-behalf swaps resources between the two players", async () => {
  const g = mainGame();
  g.players[0]!.resources = rm(1); // 1 wood
  g.players[1]!.resources = rm(0, 0, 0, 1); // 1 wheat
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByTestId("give-add-wood"));
  await userEvent.click(screen.getByTestId("want-add-wheat"));
  await userEvent.click(screen.getByRole("button", { name: /^propose$/i }));
  await userEvent.click(screen.getByTestId("accept-0-1")); // B accepts offer 0
  expect(s.getState().players[0]!.resources.wheat).toBe(1);
  expect(s.getState().players[1]!.resources.wood).toBe(1);
  expect(s.getState().tradeOffers).toHaveLength(0);
});

test("online trade panel only lets the logged-in seat accept for themselves", () => {
  const g = mainGame();
  g.players[1]!.resources = rm(0, 0, 0, 1);
  g.players[2]!.resources = rm(0, 0, 0, 1);
  g.tradeOffers = [{ id: 0, from: 0, give: rm(1), want: rm(0, 0, 0, 1) }];
  g.tradeSeq = 1;

  render(<GameProvider store={onlineStore(g, 1)}><TradePanel /></GameProvider>);

  expect(screen.getByTestId("accept-0-1")).toBeInTheDocument();
  expect(screen.queryByTestId("accept-0-2")).toBeNull();
});

test("proposer can cancel their own open offer", async () => {
  const g = mainGame();
  g.players[0]!.resources = rm(1);
  g.tradeOffers = [{ id: 0, from: 0, give: rm(1), want: rm(0, 0, 0, 1) }];
  g.tradeSeq = 1;
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
  expect(s.getState().tradeOffers).toHaveLength(0);
});

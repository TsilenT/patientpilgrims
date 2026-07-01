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
  await userEvent.click(screen.getByRole("tab", { name: "Bank" }));
  await userEvent.click(screen.getByTestId("bank-give-wood"));
  await userEvent.click(screen.getByTestId("bank-get-brick"));
  await userEvent.click(screen.getByTestId("bank-trade"));
  expect(s.getState().players[0]!.resources.wood).toBe(0);
  expect(s.getState().players[0]!.resources.brick).toBe(1);
});

test("the give stepper is capped at what you own", async () => {
  const g = mainGame();
  g.players[0]!.resources = rm(1); // a single wood
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  const add = screen.getByTestId("give-add-wood");
  expect(add).toBeEnabled();
  await userEvent.click(add);
  expect(add).toBeDisabled(); // offered your only wood → can't offer phantom cards
});

test("bank trade shows port ratios and disables unaffordable resources", async () => {
  const g = mainGame();
  const port = g.board.ports.find((p) => p.kind !== "any")!;
  const res = port.kind as "wood" | "brick" | "sheep" | "wheat" | "ore";
  g.board.buildings[port.vertices[0]!] = { owner: 0, type: "settlement" }; // 2:1 on `res`
  g.players[0]!.resources = { ...rm(), [res]: 2 };
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByRole("tab", { name: "Bank" }));
  expect(screen.getByTestId(`bank-give-${res}`)).toBeEnabled();
  expect(screen.getByTestId(`bank-give-${res}`)).toHaveTextContent("×2");
  const other = res === "wood" ? "brick" : "wood";
  expect(screen.getByTestId(`bank-give-${other}`)).toBeDisabled(); // none of it, and 4:1 anyway
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
  await userEvent.click(screen.getByRole("tab", { name: /^Trades/ }));
  await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
  expect(s.getState().tradeOffers).toHaveLength(0);
});

test("trade tab stays open before rolling", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[0]!.resources = rm(1);
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));

  expect(screen.queryByRole("button", { name: /^propose$/i })).toBeNull();
  expect(screen.queryByText(/Trades open after you roll/i)).toBeNull();
});

test("bank trade controls are hidden before rolling", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[0]!.resources = rm(4);
  const s = store(g);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByRole("tab", { name: "Bank" }));

  expect(screen.getByText(/You can trade with the bank after you roll/i)).toBeInTheDocument();
  expect(screen.queryByTestId("bank-trade")).toBeNull();
});

test("online off-turn player can propose a player trade before the active player has rolled", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[0]!.resources = rm();
  g.players[1]!.resources = rm(1);
  const s = onlineStore(g, 1);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));
  await userEvent.click(screen.getByTestId("give-add-wood"));
  await userEvent.click(screen.getByTestId("want-add-wheat"));
  await userEvent.click(screen.getByRole("button", { name: /^propose$/i }));

  expect(s.getState().tradeOffers).toHaveLength(1);
  expect(s.getState().tradeOffers[0]!.from).toBe(1);
});

test("online active player cannot propose before rolling", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[0]!.resources = rm(1);
  const s = onlineStore(g, 0);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: "Trades" }));

  expect(screen.queryByRole("button", { name: /^propose$/i })).toBeNull();
  expect(screen.getByText(/Player trades unlock after the roll/i)).toBeInTheDocument();
  expect(s.getState().tradeOffers).toHaveLength(0);
});

test("accept buttons are disabled before rolling when the offer involves the active player", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[0]!.resources = rm(1);
  g.players[1]!.resources = rm(0, 1);
  g.tradeOffers = [{ id: 0, from: 0, give: rm(1), want: rm(0, 1) }];
  g.tradeSeq = 1;
  const s = onlineStore(g, 1);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: /^Trades/ }));

  expect(screen.getByTestId("accept-0-1")).toBeDisabled();
});

test("accept buttons stay enabled before rolling when neither trader is active", async () => {
  const g = mainGame();
  g.turn.subPhase = "awaitingRoll";
  g.players[1]!.resources = rm(1);
  g.players[2]!.resources = rm(0, 1);
  g.tradeOffers = [{ id: 0, from: 1, give: rm(1), want: rm(0, 1) }];
  g.tradeSeq = 1;
  const s = onlineStore(g, 2);
  render(<GameProvider store={s}><GameView /></GameProvider>);

  await userEvent.click(screen.getByRole("tab", { name: /^Trades/ }));

  expect(screen.getByTestId("accept-0-2")).toBeEnabled();
});

test("trade tab title shows the number of open trades", () => {
  const g = mainGame();
  g.tradeOffers = [
    { id: 0, from: 0, give: rm(1), want: rm(0, 0, 0, 1) },
    { id: 1, from: 1, give: rm(0, 1), want: rm(0, 0, 1) },
  ];
  g.tradeSeq = 2;

  render(<GameProvider store={store(g)}><GameView /></GameProvider>);

  expect(screen.getByRole("tab", { name: "Trades (2)" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /^Trades$/ })).toBeNull();
});

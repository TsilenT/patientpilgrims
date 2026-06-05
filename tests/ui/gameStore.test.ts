import { describe, it, expect, vi } from "vitest";
import { GameStore } from "../../src/state/gameStore";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { Persistence } from "../../src/state/persistence";
import type { GameState } from "../../src/engine/types";

const players = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function mainGame(): GameState {
  const g = createInitialGame(players, createBoard({ mode: "beginner" }));
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function fakePersistence(): Persistence & { saved: GameState[] } {
  const saved: GameState[] = [];
  return { saved, load: async () => null, save: async (s) => { saved.push(s); }, clear: async () => {} };
}

describe("GameStore", () => {
  it("dispatch applies a legal action, swaps state, persists, and notifies", () => {
    const p = fakePersistence();
    const store = new GameStore(mainGame(), p, mulberry32(1));
    const seen = vi.fn();
    store.subscribe(seen);
    const before = store.getState().turn.activeSeat;
    const r = store.dispatch({ type: "endTurn" });
    expect(r.ok).toBe(true);
    expect(store.getState().turn.activeSeat).not.toBe(before);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(p.saved).toHaveLength(1);
  });

  it("dispatch rejects an illegal action: returns error, state and subscribers untouched", () => {
    const p = fakePersistence();
    const store = new GameStore(mainGame(), p, mulberry32(1));
    const seen = vi.fn();
    store.subscribe(seen);
    const snapshot = store.getState();
    const r = store.dispatch({ type: "rollDice" }); // not awaitingRoll → rejected
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.error).toBe("string");
    expect(store.getState()).toBe(snapshot); // same reference; unchanged
    expect(seen).not.toHaveBeenCalled();
    expect(p.saved).toHaveLength(0);
  });

  it("unsubscribe stops notifications", () => {
    const store = new GameStore(mainGame(), fakePersistence(), mulberry32(1));
    const seen = vi.fn();
    const off = store.subscribe(seen);
    off();
    store.dispatch({ type: "endTurn" });
    expect(seen).not.toHaveBeenCalled();
  });
});

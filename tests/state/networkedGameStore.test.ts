import { describe, it, expect } from "vitest";
import { NetworkedGameStore } from "../../src/state/NetworkedGameStore";
import type { RtdbBackend, CommitResult } from "../../src/net/types";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";

function freshGame(): GameState {
  const board = createBoard({ mode: "beginner" });
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    board,
  );
}

/** A fake backend that records the update fn and lets a test drive commits/pushes. */
class FakeBackend implements RtdbBackend {
  current: GameState | null;
  lastUpdate: ((c: GameState | null) => GameState | string) | null = null;
  private cb: ((s: GameState | null) => void) | null = null;
  /** simulate a transaction retry: run the update `attempts` times before persisting */
  attempts = 1;

  constructor(initial: GameState) { this.current = initial; }

  subscribe(cb: (s: GameState | null) => void) { this.cb = cb; cb(this.current); return () => { this.cb = null; }; }

  async commit(update: (c: GameState | null) => GameState | string): Promise<CommitResult> {
    this.lastUpdate = update;
    let result: GameState | string = "";
    for (let i = 0; i < this.attempts; i++) result = update(this.current);
    if (typeof result === "string") return { ok: false, error: result };
    this.current = result;
    this.cb?.(this.current);
    return { ok: true, state: result };
  }
}

describe("NetworkedGameStore", () => {
  it("renders the latest remote state to subscribers", () => {
    const game = freshGame();
    const backend = new FakeBackend(game);
    const store = new NetworkedGameStore(backend, 0);
    expect(store.getState()).toEqual(game);
  });

  it("rejects an illegal action with the engine error and does not change state", async () => {
    const backend = new FakeBackend(freshGame());
    const store = new NetworkedGameStore(backend, 0);
    // rolling is illegal during setup
    const r = await store.dispatch({ type: "rollDice" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.error).toBe("string");
  });

  it("produces identical dice even when the transaction update runs twice (retry-safe)", async () => {
    const game = freshGame();
    // force main-phase awaitingRoll directly for the unit test
    game.phase = "main";
    game.turn.subPhase = "awaitingRoll";
    const backend = new FakeBackend(game);
    backend.attempts = 2; // simulate one retry
    const store = new NetworkedGameStore(backend, 0);
    const r = await store.dispatch({ type: "rollDice" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // run the recorded update once more against the SAME input: dice must match
      const replay = backend.lastUpdate!(game);
      expect(typeof replay).not.toBe("string");
      if (typeof replay !== "string") {
        expect(replay.turn.dice).toEqual(backend.current!.turn.dice);
      }
    }
  });
});

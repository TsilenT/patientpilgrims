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

  it("is not ready and getState throws before the first remote snapshot", () => {
    const store = new NetworkedGameStore(new ManualBackend(), 0);
    expect(store.hasState()).toBe(false);
    expect(() => store.getState()).toThrow();
  });

  it("resolves whenReady and exposes state once the first snapshot arrives", async () => {
    const backend = new ManualBackend();
    const store = new NetworkedGameStore(backend, 0);
    let ready = false;
    void store.whenReady().then(() => { ready = true; });
    expect(ready).toBe(false); // not ready until the backend pushes
    const game = freshGame();
    backend.push(game);
    await store.whenReady();
    expect(ready).toBe(true);
    expect(store.hasState()).toBe(true);
    expect(store.getState()).toEqual(game);
  });

  it("is ready-but-stateless when the first snapshot is null (game not found)", async () => {
    const backend = new ManualBackend();
    const store = new NetworkedGameStore(backend, 0);
    backend.push(null);
    await store.whenReady();
    expect(store.hasState()).toBe(false);
  });
});

/** A backend whose first snapshot is pushed manually, to test the loading gate. */
class ManualBackend implements RtdbBackend {
  private cb: ((s: GameState | null) => void) | null = null;
  subscribe(cb: (s: GameState | null) => void) { this.cb = cb; return () => { this.cb = null; }; }
  push(s: GameState | null) { this.cb?.(s); }
  async commit(): Promise<CommitResult> { return { ok: false, error: "unused" }; }
}

import type { GameState, Action } from "../engine/types";
import { apply, mulberry32 } from "../engine";
import { randomSeed } from "./seed";
import type { Store, DispatchResult } from "./store";
import type { RtdbBackend, CommitResult } from "../net/types";

/**
 * Online store. `dispatch` commits the engine result inside a backend transaction.
 * Randomness is seeded ONCE before the transaction and reconstructed inside each
 * attempt, so a retry replays identical dice / steals / draws. Engine is untouched.
 */
export class NetworkedGameStore implements Store {
  private state: GameState | null;
  private listeners = new Set<() => void>();
  private loaded = false;
  private ready: Promise<void>;
  private markReady!: () => void;

  constructor(private backend: RtdbBackend, private mySeat: number) {
    this.state = null;
    this.ready = new Promise((resolve) => { this.markReady = resolve; });
    backend.subscribe((s) => {
      this.state = s;
      if (!this.loaded) { this.loaded = true; this.markReady(); }
      this.listeners.forEach((l) => l());
    });
  }

  /** Which seat this device controls (for the UI's read-only / your-turn logic). */
  seat(): number { return this.mySeat; }

  /** Resolves once the first remote snapshot (possibly null) has arrived. */
  whenReady = (): Promise<void> => this.ready;

  /** True once a non-null game state has loaded — false for a missing game. */
  hasState = (): boolean => this.state !== null;

  getState = (): GameState => {
    if (this.state === null) throw new Error("Game state not loaded yet");
    return this.state;
  };

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  dispatch = async (action: Action): Promise<DispatchResult> => {
    const seed = randomSeed();
    const result: CommitResult = await this.backend.commit((current) => {
      if (current === null) return "Game is not available";
      const rng = mulberry32(seed); // fresh per attempt → deterministic replay
      const applied = apply(current, action, rng);
      if (!applied.ok) return applied.error;
      return applied.state;
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  };
}

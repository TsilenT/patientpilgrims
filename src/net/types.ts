import type { GameState } from "../engine/types";

/** Result of a transactional commit attempt. */
export type CommitResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/**
 * Minimal Realtime-Database surface the networked store needs.
 * `commit` runs `update` against the freshest state, retrying on contention;
 * `update` returns the next state, or a string error to abort the transaction.
 */
export interface RtdbBackend {
  subscribe(cb: (state: GameState | null) => void): () => void;
  commit(update: (current: GameState | null) => GameState | string): Promise<CommitResult>;
}

export interface GameMeta {
  createdAt: number;
  playerCount: number;
  names: string[];
  seatColors: string[];
}

export interface SeatLink {
  seat: number;
  url: string;
}

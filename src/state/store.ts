import type { GameState, Action } from "../engine/types";

export type DispatchResult = { ok: true } | { ok: false; error: string };

/** The seam every view consumes. Hotseat returns sync; networked returns a promise. */
export interface Store {
  getState(): GameState;
  subscribe(cb: () => void): () => void;
  dispatch(action: Action): DispatchResult | Promise<DispatchResult>;
  /** The seat this device controls in an online game; absent for hotseat (pass-and-play). */
  seat?(): number;
}

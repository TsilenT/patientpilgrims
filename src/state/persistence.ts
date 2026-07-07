import type { GameState } from "../engine/types";

export interface Persistence {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
}

/** localStorage key for the hotseat save. Exported for the legacy-origin redirect guard. */
export const HOTSEAT_SAVE_KEY = "adultingcatan:game";

/** Phase-2 persistence: a single JSON blob in localStorage. Phase 3 swaps a Firebase impl behind the same interface. */
export class LocalStoragePersistence implements Persistence {
  async load(): Promise<GameState | null> {
    try {
      const raw = localStorage.getItem(HOTSEAT_SAVE_KEY);
      if (raw === null) return null;
      return JSON.parse(raw) as GameState;
    } catch {
      return null; // corrupt or unavailable storage → treat as no game
    }
  }
  async save(state: GameState): Promise<void> {
    try {
      localStorage.setItem(HOTSEAT_SAVE_KEY, JSON.stringify(state));
    } catch {
      /* non-fatal: storage full/unavailable; play continues in-memory */
    }
  }
  async clear(): Promise<void> {
    try { localStorage.removeItem(HOTSEAT_SAVE_KEY); } catch { /* non-fatal */ }
  }
}

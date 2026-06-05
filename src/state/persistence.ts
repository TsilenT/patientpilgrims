import type { GameState } from "../engine/types";

export interface Persistence {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
}

const KEY = "adultingcatan:game";

/** Phase-2 persistence: a single JSON blob in localStorage. Phase 3 swaps a Firebase impl behind the same interface. */
export class LocalStoragePersistence implements Persistence {
  async load(): Promise<GameState | null> {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return null;
      return JSON.parse(raw) as GameState;
    } catch {
      return null; // corrupt or unavailable storage → treat as no game
    }
  }
  async save(state: GameState): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* non-fatal: storage full/unavailable; play continues in-memory */
    }
  }
  async clear(): Promise<void> {
    try { localStorage.removeItem(KEY); } catch { /* non-fatal */ }
  }
}

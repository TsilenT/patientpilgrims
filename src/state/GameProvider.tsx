import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Store, DispatchResult } from "./store";
import type { GameState, Action } from "../engine/types";

const StoreContext = createContext<Store | null>(null);

export function GameProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useGame(): {
  state: GameState;
  dispatch: (a: Action) => DispatchResult | Promise<DispatchResult>;
  /** Seat this device controls in an online game, or null for hotseat. */
  mySeat: number | null;
} {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGame must be used within a GameProvider");
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const mySeat = store.seat ? store.seat() : null;
  return { state, dispatch: store.dispatch, mySeat };
}

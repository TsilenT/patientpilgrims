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
} {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGame must be used within a GameProvider");
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state, dispatch: store.dispatch };
}

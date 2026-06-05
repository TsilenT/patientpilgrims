import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { GameStore, DispatchResult } from "./gameStore";
import type { GameState, Action } from "../engine/types";

const StoreContext = createContext<GameStore | null>(null);

export function GameProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useGame(): { state: GameState; dispatch: (a: Action) => DispatchResult } {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGame must be used within a GameProvider");
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state, dispatch: store.dispatch };
}

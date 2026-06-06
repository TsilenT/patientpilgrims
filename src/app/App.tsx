import { useCallback, useEffect, useState } from "react";
import { GameProvider } from "../state/GameProvider";
import { GameStore } from "../state/gameStore";
import { NetworkedGameStore } from "../state/NetworkedGameStore";
import { GameView } from "../ui/GameView";
import { StartScreen } from "./StartScreen";
import { CreateOnlineGame } from "./CreateOnlineGame";
import { ClaimSeat } from "./ClaimSeat";
import { LocalStoragePersistence } from "../state/persistence";
import { cryptoRng } from "../engine";
import type { Store } from "../state/store";
import { parseRoute, type Route } from "./router";
import { isFirebaseConfigured } from "../net/firebase";
import { makeRtdbBackend, seatForUid } from "../net/game";

const persistence = new LocalStoragePersistence();

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [store, setStore] = useState<Store | null>(null);
  const [resumable, setResumable] = useState<GameStore | null>(null);
  const [creatingOnline, setCreatingOnline] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    persistence.load().then((saved) => {
      if (saved) setResumable(new GameStore(saved, persistence, cryptoRng()));
      setChecked(true);
    });
  }, []);

  // Join an online game (claimed seat or already-bound device).
  const enterOnline = useCallback((id: string) => {
    void seatForUid(id).then((seat) => {
      setStore(new NetworkedGameStore(makeRtdbBackend(id), seat));
      location.hash = `#/g/${id}`;
    });
  }, []);

  // A bare game link (already claimed elsewhere) → open it once.
  useEffect(() => {
    if (route.kind === "game" && store === null) enterOnline(route.id);
  }, [route, store, enterOnline]);

  if (store) return <GameProvider store={store}><GameView /></GameProvider>;

  if (route.kind === "claim") {
    return <ClaimSeat id={route.id} seat={route.seat} token={route.token} onClaimed={enterOnline} />;
  }
  if (route.kind === "game") {
    return <main data-testid="app-root" />; // entering online (effect above)
  }
  if (creatingOnline) {
    return <main data-testid="app-root"><CreateOnlineGame onBack={() => setCreatingOnline(false)} /></main>;
  }
  if (!checked) return <main data-testid="app-root" />;
  if (resumable) {
    return (
      <main data-testid="app-root">
        <div className="start-screen">
          <h1>Adulting Catan</h1>
          <button onClick={() => setStore(resumable)}>Resume game</button>
          <button onClick={() => { void persistence.clear(); setResumable(null); }}>New game</button>
        </div>
      </main>
    );
  }
  return (
    <main data-testid="app-root">
      <StartScreen
        onStart={setStore}
        onCreateOnline={isFirebaseConfigured() ? () => setCreatingOnline(true) : undefined}
      />
    </main>
  );
}

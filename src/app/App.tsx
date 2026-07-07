import { useCallback, useEffect, useMemo, useState } from "react";
import { GameProvider } from "../state/GameProvider";
import { GameStore } from "../state/gameStore";
import { NetworkedGameStore } from "../state/NetworkedGameStore";
import { GameView } from "../ui/GameView";
import { StartScreen } from "./StartScreen";
import { Lobby } from "./Lobby";
import { ClaimSeat } from "./ClaimSeat";
import { LocalStoragePersistence } from "../state/persistence";
import { cryptoRng } from "../engine";
import type { Store } from "../state/store";
import { parseRoute, type Route } from "./router";
import { isFirebaseConfigured } from "../net/firebase";
import { makeRtdbBackend, seatForUid } from "../net/game";
import { createLobby, getMeta, makeLobbyBackend } from "../net/lobby";

const persistence = new LocalStoragePersistence();

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [store, setStore] = useState<Store | null>(null);
  const [resumable, setResumable] = useState<GameStore | null>(null);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lobbyFor, setLobbyFor] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      const r = parseRoute(location.hash);
      setRoute(r);
      if (r.kind === "start") {
        // Leaving a game (e.g. "Back to menu" on the win screen): drop the store and re-check saves.
        setStore(null);
        setJoinError(null);
        setLobbyFor(null);
        void persistence.load().then((saved) => {
          setResumable(saved ? new GameStore(saved, persistence, cryptoRng()) : null);
        });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    persistence.load().then((saved) => {
      if (saved) setResumable(new GameStore(saved, persistence, cryptoRng()));
      setChecked(true);
    });
  }, []);

  // Join an online game (claimed seat or already-bound device). Waits for the first
  // remote snapshot before mounting the game view, so getState() is never called empty.
  const enterOnline = useCallback((id: string) => {
    setJoining(true);
    setJoinError(null);
    void (async () => {
      try {
        const seat = await seatForUid(id);
        const s = new NetworkedGameStore(makeRtdbBackend(id), seat);
        await s.whenReady();
        if (!s.hasState()) { setJoinError("Game not found."); setJoining(false); return; }
        setStore(s);
        if (location.hash !== `#/g/${id}`) location.hash = `#/g/${id}`;
        setJoining(false);
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : "Could not join the game.");
        setJoining(false);
      }
    })();
  }, []);

  // A game link → lobby while gathering players, otherwise straight into the game.
  useEffect(() => {
    if (route.kind === "game" && store === null && !joining && joinError === null && lobbyFor === null) {
      void getMeta(route.id)
        .then((meta) => {
          if (meta === null) setJoinError("Game not found.");
          else if (meta.status === "lobby") setLobbyFor(route.id);
          else enterOnline(route.id);
        })
        .catch((e) => setJoinError(e instanceof Error ? e.message : "Could not load the game."));
    }
  }, [route, store, joining, joinError, lobbyFor, enterOnline]);

  const lobbyBackend = useMemo(() => (lobbyFor === null ? null : makeLobbyBackend(lobbyFor)), [lobbyFor]);
  const enterFromLobby = useCallback((id: string) => {
    setLobbyFor(null);
    enterOnline(id);
  }, [enterOnline]);

  if (store) return <GameProvider store={store}><GameView /></GameProvider>;

  if (lobbyFor !== null && lobbyBackend !== null) {
    return (
      <main data-testid="app-root">
        <Lobby id={lobbyFor} backend={lobbyBackend} onEnterGame={enterFromLobby} />
      </main>
    );
  }

  if (joinError) {
    return (
      <main data-testid="app-root">
        <div className="start-screen">
          <h1>Couldn’t join</h1>
          <p role="alert">{joinError}</p>
          <button onClick={() => { setJoinError(null); location.hash = "#/"; }}>Back to start</button>
        </div>
      </main>
    );
  }
  if (joining) {
    return (
      <main data-testid="app-root">
        <div className="start-screen"><h1>Joining game…</h1></div>
      </main>
    );
  }

  if (route.kind === "claim") {
    return <ClaimSeat id={route.id} seat={route.seat} token={route.token} onClaimed={enterOnline} />;
  }
  if (route.kind === "game") {
    return <main data-testid="app-root" />; // resolving meta (effect above)
  }
  if (!checked) return <main data-testid="app-root" />;
  if (resumable) {
    return (
      <main data-testid="app-root">
        <div className="start-screen">
          <h1>Patient Pilgrims</h1>
          <button onClick={() => setStore(resumable)}>Resume hotseat game</button>
          <button onClick={() => { void persistence.clear(); setResumable(null); }}>Delete saved game</button>
        </div>
      </main>
    );
  }
  return (
    <main data-testid="app-root">
      <StartScreen
        onStart={setStore}
        onCreateOnline={isFirebaseConfigured() ? () => {
          void createLobby()
            .then((id) => { location.hash = `#/g/${id}`; })
            .catch((e) => setJoinError(e instanceof Error ? e.message : "Could not create the game."));
        } : undefined}
      />
    </main>
  );
}

import { useEffect, useState } from "react";
import { GameProvider } from "../state/GameProvider";
import { GameStore } from "../state/gameStore";
import { GameView } from "../ui/GameView";
import { StartScreen } from "./StartScreen";
import { LocalStoragePersistence } from "../state/persistence";
import { cryptoRng } from "../engine";

const persistence = new LocalStoragePersistence();

export function App() {
  const [store, setStore] = useState<GameStore | null>(null);
  const [resumable, setResumable] = useState<GameStore | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    persistence.load().then((saved) => {
      if (saved) setResumable(new GameStore(saved, persistence, cryptoRng()));
      setChecked(true);
    });
  }, []);

  if (store) return <GameProvider store={store}><GameView /></GameProvider>;
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
  return <main data-testid="app-root"><StartScreen onStart={setStore} /></main>;
}

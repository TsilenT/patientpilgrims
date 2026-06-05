import { useEffect, useState } from "react";
import { GameProvider } from "../state/GameProvider";
import { GameStore } from "../state/gameStore";
import { GameView } from "../ui/GameView";
import { StartScreen } from "./StartScreen";
import { LocalStoragePersistence } from "../state/persistence";
import { cryptoRng } from "../engine";

export function App() {
  const [store, setStore] = useState<GameStore | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const p = new LocalStoragePersistence();
    p.load().then((saved) => {
      if (saved) setStore(new GameStore(saved, p, cryptoRng()));
      setChecked(true);
    });
  }, []);

  if (!checked) return <main data-testid="app-root" />;
  if (!store) return <main data-testid="app-root"><StartScreen onStart={setStore} /></main>;
  return <GameProvider store={store}><GameView /></GameProvider>;
}

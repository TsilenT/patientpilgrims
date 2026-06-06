import { useState } from "react";
import { GameStore } from "../state/gameStore";
import { LocalStoragePersistence } from "../state/persistence";
import { createInitialGame, cryptoRng } from "../engine";
import { createBoard } from "../board";

const COLORS = ["red", "blue", "white", "orange"];
const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function StartScreen({ onStart, onCreateOnline }: {
  onStart: (store: GameStore) => void;
  onCreateOnline?: (() => void) | undefined;
}) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [mode, setMode] = useState<"beginner" | "random">("beginner");

  const start = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      name: names[i]!.trim() || DEFAULT_NAMES[i]!,
      color: COLORS[i]!,
    }));
    const rng = cryptoRng();
    const board = mode === "random"
      ? createBoard({ mode: "random", rng })
      : createBoard({ mode: "beginner" });
    onStart(new GameStore(createInitialGame(players, board), new LocalStoragePersistence(), rng));
  };

  return (
    <div className="start-screen">
      <h1>Adulting Catan</h1>
      <label>Players:{" "}
        <select aria-label="Player count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="player-row">
          <span className="swatch" style={{ background: COLORS[i] }} aria-hidden="true" />
          <input aria-label={`Player ${i + 1} name`} value={names[i]}
            onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))} />
        </div>
      ))}
      <fieldset>
        <legend>Board</legend>
        <label><input type="radio" name="mode" checked={mode === "beginner"} onChange={() => setMode("beginner")} /> Beginner</label>
        <label><input type="radio" name="mode" checked={mode === "random"} onChange={() => setMode("random")} /> Random</label>
      </fieldset>
      <button onClick={start}>Start Game</button>
      {onCreateOnline && <button onClick={onCreateOnline}>New online game</button>}
    </div>
  );
}

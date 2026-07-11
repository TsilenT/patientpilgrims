import { useState } from "react";
import { GameStore } from "../state/gameStore";
import { LocalStoragePersistence } from "../state/persistence";
import { createInitialGame, cryptoRng } from "../engine";
import { createBoard, type BoardMode } from "../board";
import { BoardModePicker } from "./BoardModePicker";

const COLORS = ["red", "blue", "white", "orange"];
const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function HotseatLobby({ resumable, onStart, onDeleteSave }: {
  resumable: GameStore | null;
  onStart: (store: GameStore) => void;
  onDeleteSave: () => void;
}) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [mode, setMode] = useState<BoardMode>("random");

  const start = () => {
    const players = Array.from({ length: count }, (_, i) => ({
      name: names[i]!.trim() || DEFAULT_NAMES[i]!,
      color: COLORS[i]!,
    }));
    const rng = cryptoRng();
    const board = mode === "beginner"
      ? createBoard({ mode: "beginner" })
      : createBoard({ mode, rng });
    onStart(new GameStore(createInitialGame(players, board, rng), new LocalStoragePersistence(), rng));
  };

  return (
    <div className="start-screen">
      <h1>Hotseat game</h1>
      {resumable && (
        <section className="hotseat-resume">
          <button className="btn-primary" onClick={() => onStart(resumable)}>Resume game</button>
          <button onClick={onDeleteSave}>Delete saved game</button>
        </section>
      )}
      <section className="hotseat-new" aria-labelledby="hotseat-new-heading">
        <h2 id="hotseat-new-heading">New game</h2>
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
        <BoardModePicker value={mode} onChange={setMode} />
        {resumable && <p className="hotseat-warning">Starting a new game replaces your saved game.</p>}
        <button className="btn-primary" onClick={start}>Start game</button>
      </section>
      <button className="back-link" onClick={() => { location.hash = "#/"; }}>‹ Back to menu</button>
    </div>
  );
}

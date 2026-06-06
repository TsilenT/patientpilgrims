import { useState } from "react";
import { createGame } from "../net/game";
import type { SeatLink } from "../net/types";

const COLORS = ["red", "blue", "white", "orange"];
const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function CreateOnlineGame({ onBack }: { onBack: () => void }) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [mode, setMode] = useState<"beginner" | "random">("beginner");
  const [links, setLinks] = useState<SeatLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const players = Array.from({ length: count }, (_, i) => ({
        name: names[i]!.trim() || DEFAULT_NAMES[i]!, color: COLORS[i]!,
      }));
      const result = await createGame({ players, mode });
      setLinks(result.links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the game");
    } finally { setBusy(false); }
  };

  if (links) {
    return (
      <div className="start-screen">
        <h1>Game created</h1>
        <p>Send each link to the right player. Each opens their seat.</p>
        <ul className="seat-links">
          {links.map((l) => (
            <li key={l.seat}>
              <span className="swatch" style={{ background: COLORS[l.seat] }} aria-hidden="true" />
              {names[l.seat]}: <input readOnly value={l.url} aria-label={`Seat ${l.seat + 1} link`}
                onFocus={(e) => e.currentTarget.select()} />
            </li>
          ))}
        </ul>
        <button onClick={onBack}>Done</button>
      </div>
    );
  }

  return (
    <div className="start-screen">
      <h1>New online game</h1>
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
      {error && <p role="alert">{error}</p>}
      <button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create game"}</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}

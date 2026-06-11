import { useState, type CSSProperties } from "react";
import { useGame } from "../../state/GameProvider";
import { gameSummary } from "../../engine/scoring/summary";
import { LocalStoragePersistence } from "../../state/persistence";

function Crown() {
  return (
    <svg className="crown" viewBox="0 0 64 44" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" fill="var(--gold)" />
      <circle cx="32" cy="4" r="2.5" fill="var(--gold)" />
      <circle cx="54" cy="10" r="2.5" fill="var(--gold)" />
      <path d="M6 34 L10 13 L22 23 L32 6 L42 23 L54 13 L58 34 Z" fill="var(--gold)" />
      <rect x="6" y="36" width="52" height="5" rx="2.5" fill="var(--gold)" />
    </svg>
  );
}

export function WinScreen() {
  const { state, mySeat } = useGame();
  const [open, setOpen] = useState(true);
  if (state.phase !== "finished" || state.winner === undefined) return null;

  if (!open) {
    return <button className="results-pill" onClick={() => setOpen(true)}>👑 Results</button>;
  }

  const summary = gameSummary(state);
  const king = state.players[summary.winner]!;
  const kingRow = summary.standings.find((r) => r.seat === summary.winner)!;

  const newGame = () => {
    if (mySeat === null) void new LocalStoragePersistence().clear(); // hotseat: drop the finished save
    location.hash = "#/"; // App returns to the start screen on this route
  };

  return (
    <div className="win-backdrop">
      <div
        className="win-screen"
        role="dialog"
        aria-modal="true"
        aria-label="Game over"
        style={{ "--banner": king.color } as CSSProperties}
      >
        <div className="win-banners" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="pennant" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        <Crown />
        <h2>Long live {king.name}!</h2>
        <p className="win-sub">Sovereign of Catan · {kingRow.totalVp} victory points</p>
        <ol className="standings">
          {summary.standings.map((p) => (
            <li key={p.seat} className={p.seat === summary.winner ? "is-winner" : undefined}>
              <span className="rank">{p.rank}</span>
              <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
              <span className="who">
                <strong>{p.name}</strong>
                <span className="court-title">{p.title.text} · {p.title.detail}</span>
              </span>
              <span className="tally">
                <strong className="vp">{p.totalVp} VP</strong>
                <span className="chips">
                  {p.breakdown.settlements > 0 && <span>⌂ {p.breakdown.settlements}</span>}
                  {p.breakdown.cities > 0 && <span>🏰 {p.breakdown.cities}</span>}
                  {p.breakdown.vpCards > 0 && <span>📜 {p.breakdown.vpCards}</span>}
                  {p.breakdown.largestArmy && <span>⚔️ Army</span>}
                  {p.breakdown.longestRoad && <span>🛤️ Road</span>}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <div className="win-actions">
          <button onClick={() => setOpen(false)}>View the realm</button>
          <button className="btn-primary" onClick={newGame}>New game</button>
        </div>
      </div>
    </div>
  );
}

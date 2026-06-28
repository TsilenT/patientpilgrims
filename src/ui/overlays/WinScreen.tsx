import { useState, type CSSProperties } from "react";
import { useGame } from "../../state/GameProvider";
import { gameSummary } from "../../engine/scoring/summary";
import { LocalStoragePersistence } from "../../state/persistence";
import type { GameState } from "../../engine/types";
import { CrownIcon, SettlementIcon, CityIcon, StarIcon, KnightIcon, RoadIcon } from "../icons";

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

const ROLL_TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function rollStats(state: GameState) {
  const counts = new Map<number, number>(ROLL_TOTALS.map((sum) => [sum, 0]));
  for (const entry of state.log) {
    // Only main-game dice rolls are logged as "roll"; opening turn-order rolls are "orderRoll".
    if (entry.type !== "roll" || entry.sum === undefined) continue;
    counts.set(entry.sum, (counts.get(entry.sum) ?? 0) + 1);
  }
  return {
    total: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
    counts,
  };
}

export function WinScreen() {
  const { state, mySeat } = useGame();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"standings" | "dice">("standings");
  if (state.phase !== "finished" || state.winner === undefined) return null;

  if (!open) {
    return <button className="results-pill" onClick={() => setOpen(true)}><CrownIcon className="btn-icon" /> Results</button>;
  }

  const summary = gameSummary(state);
  const diceStats = rollStats(state);
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
        <div className="win-tabs" role="tablist" aria-label="Game over sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "standings"}
            aria-controls="win-panel-standings"
            id="win-tab-standings"
            onClick={() => setTab("standings")}
          >
            Standings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "dice"}
            aria-controls="win-panel-dice"
            id="win-tab-dice"
            onClick={() => setTab("dice")}
          >
            Dice stats
          </button>
        </div>
        {tab === "standings" ? (
          <ol
            className="standings"
            role="tabpanel"
            id="win-panel-standings"
            aria-labelledby="win-tab-standings"
          >
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
                    {p.breakdown.settlements > 0 && <span><SettlementIcon className="chip-icon" /> {p.breakdown.settlements}</span>}
                    {p.breakdown.cities > 0 && <span><CityIcon className="chip-icon" /> {p.breakdown.cities}</span>}
                    {p.breakdown.vpCards > 0 && <span><StarIcon className="chip-icon" /> {p.breakdown.vpCards}</span>}
                    {p.breakdown.largestArmy && <span><KnightIcon className="chip-icon" /> Army</span>}
                    {p.breakdown.longestRoad && <span><RoadIcon className="chip-icon" /> Road</span>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <section
            className="win-dice-stats"
            role="tabpanel"
            id="win-panel-dice"
            aria-labelledby="win-tab-dice"
          >
            <div className="win-dice-stats__header">
              <h3>Dice roll stats</h3>
              <span>{diceStats.total} turn {diceStats.total === 1 ? "roll" : "rolls"}</span>
            </div>
            <div className="win-dice-stats__grid">
              {ROLL_TOTALS.map((sum) => {
                const count = diceStats.counts.get(sum) ?? 0;
                const pct = diceStats.total > 0 ? Math.round((count / diceStats.total) * 100) : 0;
                return (
                  <div key={sum} className="win-dice-stat" aria-label={`${sum}: ${count} rolls, ${pct}%`}>
                    <strong>{sum}</strong>
                    <span>{count}</span>
                    <small>{pct}%</small>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <div className="win-actions">
          <button onClick={() => setOpen(false)}>View the realm</button>
          <button className="btn-primary" onClick={newGame}>Back to menu</button>
        </div>
      </div>
    </div>
  );
}

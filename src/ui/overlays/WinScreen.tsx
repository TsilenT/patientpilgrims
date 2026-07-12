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
  const [section, setSection] = useState<"standings" | "dice" | "other">("standings");
  if (state.phase !== "finished" || state.winner === undefined) return null;

  if (!open) {
    return <button className="results-pill" onClick={() => setOpen(true)}><CrownIcon className="btn-icon" /> Results</button>;
  }

  const summary = gameSummary(state);
  const diceStats = rollStats(state);
  // Bars fill relative to the most-rolled number so the grid reads as a histogram.
  const maxCount = Math.max(1, ...diceStats.counts.values());
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
        <p className="win-sub">{kingRow.title.text} · {kingRow.totalVp} victory points</p>
        <label className="win-section-picker">
          <span>Results section</span>
          <select value={section} onChange={(e) => setSection(e.target.value as typeof section)}>
            <option value="standings">Standings</option>
            <option value="dice">Dice stats</option>
            <option value="other">Other stats</option>
          </select>
        </label>
        {section === "standings" ? (
          <ol
            className="standings"
            aria-label="Standings"
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
        ) : section === "dice" ? (
          <section
            className="win-dice-stats"
            role="region"
            aria-label="Dice stats"
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
                  <div key={sum} className="win-dice-stat" aria-label={`${sum}: ${count} rolls, ${pct}%`}
                    style={{ "--fill": `${(count / maxCount) * 100}%` } as CSSProperties}>
                    <strong>{sum}</strong>
                    <span>{count}</span>
                    <small>{pct}%</small>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="win-other-stats" role="region" aria-label="Other stats">
            <div className="win-other-stats__header">
              <h3>Other stats</h3>
              <span>Totals by player</span>
            </div>
            <div className="win-other-stats__scroll">
              <table>
                <thead><tr>
                  <th>Player</th><th title="Resources blocked by the robber">Blocked</th>
                  <th title="Resources stolen with the robber">Stolen</th><th title="Cards discarded after rolling 7">Discarded</th>
                  <th>7s</th><th>Trades</th><th>Builds</th><th>Dev cards</th>
                </tr></thead>
                <tbody>{summary.otherStats.map((p) => (
                  <tr key={p.seat}>
                    <th><span className="swatch" style={{ background: p.color }} aria-hidden="true" />{p.name}</th>
                    <td>{p.resourcesBlocked}</td><td>{p.resourcesStolen}</td><td>{p.resourcesDiscarded}</td>
                    <td>{p.sevensRolled}</td><td>{p.trades}</td><td>{p.builds}</td><td>{p.devCardsBought}</td>
                  </tr>
                ))}</tbody>
              </table>
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

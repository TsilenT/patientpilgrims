import { useEffect, useRef, useState, type CSSProperties } from "react";
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
const RESULT_SECTIONS = [
  { value: "standings", label: "Standings", detail: "Final ranks and titles" },
  { value: "dice", label: "Dice stats", detail: "Roll totals and distribution" },
  { value: "resources", label: "Resources", detail: "Gained minus stolen over time" },
  { value: "other", label: "Other stats", detail: "Robber, discards, trades, and builds" },
] as const;
type ResultSection = (typeof RESULT_SECTIONS)[number]["value"];

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

function ResourceHistoryChart({ histories }: { histories: ReturnType<typeof gameSummary>["resourceHistory"] }) {
  const width = 460;
  const height = 200;
  const left = 30;
  const right = 10;
  const top = 12;
  const bottom = 24;
  const allValues = histories.flatMap((history) => history.values);
  const rawMin = Math.min(0, ...allValues);
  const rawMax = Math.max(0, ...allValues);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const steps = Math.max(1, histories[0]?.values.length ? histories[0].values.length - 1 : 0);
  const x = (index: number) => left + (index / steps) * (width - left - right);
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const ticks = Array.from(new Set([min, 0, max])).sort((a, b) => a - b);

  return (
    <section className="win-resource-history" role="region" aria-label="Resources over time">
      <div className="win-resource-history__header">
        <h3>Resources over time</h3>
        <span>Production gains and robber steals</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Resources gained minus stolen over time">
        {ticks.map((tick) => (
          <g key={tick} className={tick === 0 ? "resource-zero-line" : "resource-grid-line"}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
            <text x={left - 6} y={y(tick) + 3}>{tick}</text>
          </g>
        ))}
        <line className="resource-axis" x1={left} x2={left} y1={top} y2={height - bottom} />
        <line className="resource-axis" x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} />
        <text className="resource-axis-label" x={left} y={height - 6}>Start</text>
        <text className="resource-axis-label" x={width - right} y={height - 6} textAnchor="end">End</text>
        {histories.map((history) => (
          <path
            key={history.seat}
            className="resource-history-line"
            d={history.values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ")}
            style={{ "--player-color": history.color } as CSSProperties}
          />
        ))}
      </svg>
      <ul className="resource-history-legend" aria-label="Final net resources">
        {histories.map((history) => {
          const total = history.values.at(-1) ?? 0;
          return (
            <li key={history.seat} aria-label={`${history.name}: ${total} net resources`}>
              <span className="swatch" style={{ background: history.color }} aria-hidden="true" />
              <span>{history.name}</span><strong>{total > 0 ? `+${total}` : total}</strong>
            </li>
          );
        })}
      </ul>
      <p>Trades and building costs are excluded.</p>
    </section>
  );
}

export function WinScreen() {
  const { state, mySeat } = useGame();
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<ResultSection>("standings");
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const sectionPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sectionMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!sectionPickerRef.current?.contains(event.target as Node)) setSectionMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sectionMenuOpen]);
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
        <div className="win-section-picker" ref={sectionPickerRef}>
          <span className="win-section-picker__label">Results section</span>
          <button type="button" className="win-section-trigger"
            aria-label={`Results section: ${RESULT_SECTIONS.find((item) => item.value === section)!.label}`}
            aria-expanded={sectionMenuOpen} aria-haspopup="listbox"
            onClick={() => setSectionMenuOpen((open) => !open)}>
            <span><strong>{RESULT_SECTIONS.find((item) => item.value === section)!.label}</strong>
              <small>{RESULT_SECTIONS.find((item) => item.value === section)!.detail}</small></span>
            <span className="win-section-chevron" aria-hidden="true">⌄</span>
          </button>
          {sectionMenuOpen && <div className="win-section-menu" role="listbox" aria-label="Results section">
            {RESULT_SECTIONS.map((item) => <button type="button" role="option" key={item.value}
              aria-selected={section === item.value} onClick={() => { setSection(item.value); setSectionMenuOpen(false); }}>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              {section === item.value && <span className="win-section-check" aria-hidden="true">✓</span>}
            </button>)}
          </div>}
        </div>
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
        ) : section === "resources" ? (
          <ResourceHistoryChart histories={summary.resourceHistory} />
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
                  <th title="Resources stolen with the robber">Stolen</th><th title="Resources stolen from this player">Stolen from</th>
                  <th title="Cards discarded after rolling 7">Discarded</th>
                  <th>7s</th><th>Trades</th><th>Builds</th><th>Dev cards</th>
                </tr></thead>
                <tbody>{summary.otherStats.map((p) => (
                  <tr key={p.seat}>
                    <th><span className="swatch" style={{ background: p.color }} aria-hidden="true" />{p.name}</th>
                    <td>{p.resourcesBlocked}</td><td>{p.resourcesStolen}</td><td>{p.resourcesStolenFrom}</td><td>{p.resourcesDiscarded}</td>
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

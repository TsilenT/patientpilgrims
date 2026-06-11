# Royal Win Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare "X wins!" banner with a royalty-themed end screen: crowned winner, color-matched heraldic banners, full standings with revealed VP, and a court title for every player.

**Architecture:** A pure `gameSummary(state)` function in the engine's scoring layer derives standings, VP breakdowns, and court titles from `GameState` (players, board, awards, log). A thin `WinScreen` overlay component renders it; `GameView` swaps the old `GameOverBanner` for it; `App` learns to return to the start screen on hash navigation so "New game" works without a reload.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (jsdom), plain CSS in `src/ui/styles.css`.

Spec: `docs/superpowers/specs/2026-06-11-royal-win-screen-design.md`

---

### Task 1: `gameSummary` engine module

**Files:**
- Create: `src/engine/scoring/summary.ts`
- Test: `tests/engine/summary.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/summary.test.ts
import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { gameSummary } from "../../src/engine/scoring/summary";
import type { GameState } from "../../src/engine/types";

const players3 = [
  { name: "Alice", color: "red" },
  { name: "Bob", color: "blue" },
  { name: "Carol", color: "white" },
];

/** Finished game, Alice (seat 0) winning 10–7–5, empty log. */
function finished(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "finished";
  g.winner = 0;
  delete g.setup;
  g.players[0]!.victoryPoints = 10;
  g.players[1]!.victoryPoints = 7;
  g.players[2]!.victoryPoints = 5;
  return g;
}

describe("standings", () => {
  it("sorts by total VP and assigns ranks", () => {
    const s = gameSummary(finished());
    expect(s.winner).toBe(0);
    expect(s.standings.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(s.standings.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(s.standings.map((p) => p.totalVp)).toEqual([10, 7, 5]);
  });

  it("reveals hidden victory-point dev cards in totals", () => {
    const g = finished();
    g.players[1]!.devCards = [
      { type: "victoryPoint", boughtThisTurn: false, played: false },
      { type: "victoryPoint", boughtThisTurn: false, played: false },
    ];
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.totalVp).toBe(9);
    expect(s.standings.find((p) => p.seat === 1)!.breakdown.vpCards).toBe(2);
  });

  it("puts the winner first when totals tie", () => {
    const g = finished();
    g.players[1]!.victoryPoints = 10;
    const s = gameSummary(g);
    expect(s.standings[0]!.seat).toBe(0);
    expect(s.standings[0]!.rank).toBe(1);
    expect(s.standings[1]!.rank).toBe(1); // ties share the better rank
  });

  it("counts buildings and awards in the breakdown", () => {
    const g = finished();
    g.board.buildings["x1"] = { owner: 0, type: "settlement" };
    g.board.buildings["x2"] = { owner: 0, type: "city" };
    g.awards.largestArmy = 0;
    const b = gameSummary(g).standings.find((p) => p.seat === 0)!.breakdown;
    expect(b).toEqual({ settlements: 1, cities: 1, vpCards: 0, largestArmy: true, longestRoad: false });
  });
});

describe("court titles", () => {
  it("always crowns the winner Sovereign of Catan", () => {
    const s = gameSummary(finished());
    expect(s.standings.find((p) => p.seat === 0)!.title).toEqual({
      text: "Sovereign of Catan",
      detail: "first of their name",
    });
  });

  it("awards stat titles by priority, one per player, winner excluded", () => {
    const g = finished();
    g.players[0]!.knightsPlayed = 9; // winner never takes a court title
    g.players[1]!.knightsPlayed = 3;
    g.players[1]!.longestRoadLength = 8;
    g.players[2]!.longestRoadLength = 5;
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.title).toEqual({
      text: "Lord Commander of the Army",
      detail: "3 knights led to battle",
    });
    expect(s.standings.find((p) => p.seat === 2)!.title).toEqual({
      text: "Warden of the King's Roads",
      detail: "a road 5 segments long",
    });
  });

  it("breaks metric ties toward the lower seat", () => {
    const g = finished();
    g.players[1]!.knightsPlayed = 2;
    g.players[2]!.knightsPlayed = 2;
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.title.text).toBe("Lord Commander of the Army");
  });

  it("sums discarded cards from the log for Martyr of the Treasury", () => {
    const g = finished();
    g.log.push({ type: "discard", seat: 2, count: 4 }, { type: "discard", seat: 2, count: 3 });
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 2)!.title).toEqual({
      text: "Martyr of the Treasury",
      detail: "7 cards tithed to the crown",
    });
  });

  it("falls back to rank titles when no stats stand out", () => {
    const s = gameSummary(finished()); // empty log, zero metrics
    expect(s.standings.find((p) => p.seat === 1)!.title.text).toBe("Heir to the Throne");
    expect(s.standings.find((p) => p.seat === 2)!.title.text).toBe("Court Jester"); // last place
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/summary.test.ts`
Expected: FAIL — cannot resolve `src/engine/scoring/summary`.

- [ ] **Step 3: Implement `gameSummary`**

```ts
// src/engine/scoring/summary.ts
import type { GameState, LogEntry } from "../types";
import { totalVictoryPoints } from "./victory";

export interface PlayerSummary {
  seat: number;
  name: string;
  color: string;
  /** 1-based; ties share the better rank. */
  rank: number;
  /** Includes hidden victory-point dev cards — the game is over. */
  totalVp: number;
  breakdown: {
    settlements: number;
    cities: number;
    vpCards: number;
    largestArmy: boolean;
    longestRoad: boolean;
  };
  title: { text: string; detail: string };
}

export interface GameSummary {
  winner: number;
  standings: PlayerSummary[];
}

interface CourtTitle {
  text: string;
  metric: (state: GameState, seat: number) => number;
  detail: (n: number) => string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const countLog = (state: GameState, seat: number, pred: (e: LogEntry) => boolean) =>
  state.log.filter((e) => e.seat === seat && pred(e)).length;

/** Priority-ordered; each goes to the unassigned non-winner with the strict max metric (> 0). */
const COURT_TITLES: CourtTitle[] = [
  {
    text: "Lord Commander of the Army",
    metric: (s, seat) => s.players[seat]!.knightsPlayed,
    detail: (n) => `${plural(n, "knight")} led to battle`,
  },
  {
    text: "Warden of the King's Roads",
    metric: (s, seat) => s.players[seat]!.longestRoadLength,
    detail: (n) => `a road ${n} segments long`,
  },
  {
    text: "Master of Coin",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "proposeTrade" || e.type === "tradeBank"),
    detail: (n) => `${plural(n, "deal")} brokered`,
  },
  {
    text: "Court Wizard",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "buyDevCard"),
    detail: (n) => `${plural(n, "scroll")} studied`,
  },
  {
    text: "Shadow of the Realm",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "steal"),
    detail: (n) => plural(n, "daring heist"),
  },
  {
    text: "Herald of Misfortune",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "roll" && e.sum === 7),
    detail: (n) => `summoned the robber ${n === 1 ? "once" : `${n} times`}`,
  },
  {
    text: "Martyr of the Treasury",
    metric: (s, seat) =>
      s.log
        .filter((e) => e.seat === seat && e.type === "discard")
        .reduce((total, e) => total + (e.count ?? 0), 0),
    detail: (n) => `${plural(n, "card")} tithed to the crown`,
  },
  {
    text: "Master Builder of the Realm",
    metric: (s, seat) =>
      countLog(s, seat, (e) => e.type === "buildSettlement" || e.type === "buildCity" || e.type === "setupSettlement"),
    detail: (n) => `${plural(n, "great work")} raised`,
  },
];

/** Everything the win screen shows, derived once from the finished state. */
export function gameSummary(state: GameState): GameSummary {
  const winner = state.winner!;
  const totals = state.players.map((p) => totalVictoryPoints(state, p.seat));

  const order = state.players
    .map((p) => p.seat)
    .sort((a, b) => totals[b]! - totals[a]! || (a === winner ? -1 : b === winner ? 1 : a - b));

  const rankBySeat = new Map<number, number>();
  order.forEach((seat, i) => {
    const ahead = order[i - 1];
    rankBySeat.set(seat, i > 0 && totals[seat] === totals[ahead!] ? rankBySeat.get(ahead!)! : i + 1);
  });

  const titles = new Map<number, { text: string; detail: string }>();
  titles.set(winner, { text: "Sovereign of Catan", detail: "first of their name" });
  for (const t of COURT_TITLES) {
    let bestSeat = -1;
    let bestVal = 0;
    for (const p of state.players) {
      if (titles.has(p.seat)) continue;
      const v = t.metric(state, p.seat);
      if (v > bestVal) { bestVal = v; bestSeat = p.seat; }
    }
    if (bestSeat >= 0) titles.set(bestSeat, { text: t.text, detail: t.detail(bestVal) });
  }
  order.forEach((seat, i) => {
    if (titles.has(seat)) return;
    const rank = rankBySeat.get(seat)!;
    titles.set(
      seat,
      i === order.length - 1 ? { text: "Court Jester", detail: "beloved by the court all the same" }
      : rank === 2 ? { text: "Heir to the Throne", detail: "the realm's second choice" }
      : rank === 3 ? { text: "Royal Chancellor", detail: "keeper of the royal ledgers" }
      : { text: "Noble of the Realm", detail: "steadfast and true" },
    );
  });

  const standings = order.map((seat) => {
    const p = state.players[seat]!;
    let settlements = 0;
    let cities = 0;
    for (const b of Object.values(state.board.buildings)) {
      if (b.owner !== seat) continue;
      if (b.type === "city") cities++; else settlements++;
    }
    return {
      seat,
      name: p.name,
      color: p.color,
      rank: rankBySeat.get(seat)!,
      totalVp: totals[seat]!,
      breakdown: {
        settlements,
        cities,
        vpCards: p.devCards.filter((c) => c.type === "victoryPoint").length,
        largestArmy: state.awards.largestArmy === seat,
        longestRoad: state.awards.longestRoad === seat,
      },
      title: titles.get(seat)!,
    };
  });

  return { winner, standings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/summary.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/scoring/summary.ts tests/engine/summary.test.ts
git commit -m "feat: gameSummary — standings, VP breakdown, court titles"
```

---

### Task 2: WinScreen component, styles, and integration

**Files:**
- Create: `src/ui/overlays/WinScreen.tsx`
- Delete: `src/ui/overlays/GameOverBanner.tsx`
- Modify: `src/ui/GameView.tsx:18,177` (swap import + element)
- Modify: `src/app/App.tsx:27-31` (hash → start returns to start screen)
- Modify: `src/ui/styles.css:248,266` (drop `.game-over`, add win-screen styles)
- Modify: `tests/ui/panels.test.tsx:9,78-87`, `tests/ui/e2e.test.tsx:41` (old banner assertions)
- Test: `tests/ui/winscreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/ui/winscreen.test.tsx
// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { GameView } from "../../src/ui/GameView";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import type { GameState } from "../../src/engine/types";

function finishedGame(): GameState {
  const g = createInitialGame(
    [{ name: "Alice", color: "red" }, { name: "Bob", color: "blue" }, { name: "Carol", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "finished";
  g.winner = 0;
  g.turn = { activeSeat: 0, subPhase: "main" };
  delete g.setup;
  g.players[0]!.victoryPoints = 10;
  g.players[1]!.victoryPoints = 7;
  g.players[2]!.victoryPoints = 5;
  g.players[1]!.knightsPlayed = 3;
  return g;
}

function renderFinished() {
  const store = new GameStore(finishedGame(), new LocalStoragePersistence(), mulberry32(0));
  render(<GameProvider store={store}><GameView /></GameProvider>);
}

test("crowns the winner and lists every player with VP and court title", () => {
  renderFinished();
  const dialog = screen.getByRole("dialog", { name: /game over/i });
  expect(dialog).toHaveTextContent("Long live Alice!");
  expect(dialog).toHaveTextContent("Sovereign of Catan · 10 victory points");
  expect(dialog).toHaveTextContent("Lord Commander of the Army");
  expect(dialog).toHaveTextContent("Carol");
  expect(dialog).toHaveTextContent("Court Jester");
});

test("view the realm dismisses the screen and the results pill reopens it", async () => {
  renderFinished();
  await userEvent.click(screen.getByRole("button", { name: /view the realm/i }));
  expect(screen.queryByRole("dialog", { name: /game over/i })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /results/i }));
  expect(screen.getByRole("dialog", { name: /game over/i })).toBeInTheDocument();
});

test("new game clears the hotseat save and navigates to the start screen", async () => {
  localStorage.setItem("adultingcatan:game", JSON.stringify(finishedGame()));
  renderFinished();
  await userEvent.click(screen.getByRole("button", { name: /new game/i }));
  expect(localStorage.getItem("adultingcatan:game")).toBeNull();
  expect(location.hash).toBe("#/");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/winscreen.test.tsx`
Expected: FAIL — "Long live Alice!" not found (old banner renders "Alice wins!").

- [ ] **Step 3: Implement `WinScreen`**

```tsx
// src/ui/overlays/WinScreen.tsx
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
```

- [ ] **Step 4: Swap it into `GameView`, teach `App` the start route, delete the old banner**

In `src/ui/GameView.tsx` replace
`import { GameOverBanner } from "./overlays/GameOverBanner";` with
`import { WinScreen } from "./overlays/WinScreen";` and `<GameOverBanner />` with `<WinScreen />`.

In `src/app/App.tsx`, replace the hashchange effect (lines 27–31) with:

```tsx
  useEffect(() => {
    const onHash = () => {
      const r = parseRoute(location.hash);
      setRoute(r);
      if (r.kind === "start") {
        // Leaving a game (e.g. "New game" on the win screen): drop the store and re-check saves.
        setStore(null);
        setJoinError(null);
        void persistence.load().then((saved) => {
          setResumable(saved ? new GameStore(saved, persistence, cryptoRng()) : null);
        });
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
```

Delete `src/ui/overlays/GameOverBanner.tsx` (`git rm`).

- [ ] **Step 5: Styles**

In `src/ui/styles.css`: remove `.game-over` from the dialog group selector (line 248) and delete the `.game-over h2` rule (line 266). Append:

```css
/* ---- Win screen (royal) ---- */
.win-backdrop { position: fixed; inset: 0; background: rgba(5, 8, 12, 0.65); z-index: 30; }
.win-screen {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(94vw, 520px);
  height: fit-content;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--gold);
  border-radius: 16px;
  padding: 46px 20px 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  z-index: 31;
  text-align: center;
}
.win-banners {
  position: absolute;
  top: 0; left: 14px; right: 14px;
  display: flex;
  justify-content: space-evenly;
  pointer-events: none;
}
.pennant {
  width: 26px;
  height: 46px;
  background: var(--banner, var(--gold));
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-top: none;
  clip-path: polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%);
  animation: pennant-drop 0.5s ease-out both;
}
.pennant:nth-child(even) { height: 36px; filter: brightness(0.82); }
@keyframes pennant-drop {
  from { transform: translateY(-110%); }
  to { transform: translateY(0); }
}
.crown {
  width: 62px;
  display: block;
  margin: 6px auto 0;
  filter: drop-shadow(0 2px 10px rgba(242, 193, 78, 0.45));
  animation: crown-rise 0.6s ease-out both;
}
@keyframes crown-rise {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to { opacity: 1; transform: none; }
}
.win-screen h2 { color: var(--gold); margin: 8px 0 2px; font-size: 1.55rem; }
.win-sub { color: var(--muted); margin: 0 0 16px; }
.standings {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}
.standings li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--panel-2);
  border: 1px solid var(--panel-edge);
  border-radius: 10px;
  padding: 8px 12px;
}
.standings li.is-winner { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
.standings .rank { color: var(--muted); font-weight: 700; min-width: 1.1em; text-align: center; }
.standings li.is-winner .rank { color: var(--gold); }
.standings .swatch {
  width: 14px; height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex: none;
}
.standings .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.standings .court-title { color: var(--muted); font-size: 0.82rem; }
.standings .tally { text-align: right; flex: none; }
.standings .vp { color: var(--gold); display: block; }
.standings .chips {
  color: var(--muted);
  font-size: 0.74rem;
  display: flex;
  gap: 7px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.win-actions { display: flex; gap: 10px; justify-content: center; }
.results-pill {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 30;
  border-color: var(--gold);
  color: var(--gold);
  border-radius: 999px;
}
```

- [ ] **Step 6: Update the two tests that assert the old banner**

`tests/ui/e2e.test.tsx:41`: replace
`expect(screen.getByText(/A wins/i)).toBeInTheDocument();` with
`expect(screen.getByRole("dialog", { name: /game over/i })).toHaveTextContent("Long live A!");`

`tests/ui/panels.test.tsx`: replace the `GameOverBanner` import (line 9) with
`import { WinScreen } from "../../src/ui/overlays/WinScreen";` and the two tests (lines 78–87) with:

```tsx
test("win screen crowns the winner when finished", () => {
  const g = mainGame();
  g.phase = "finished"; g.winner = 1;
  render(<GameProvider store={store(g)}><WinScreen /></GameProvider>);
  expect(screen.getByText(/long live B/i)).toBeInTheDocument();
});

test("win screen renders nothing during play", () => {
  const { container } = render(<GameProvider store={store(mainGame())}><WinScreen /></GameProvider>);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests pass including the 3 new winscreen tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: royal coronation win screen

Crowned winner with color-matched pennants, full standings with
revealed VP and per-player court titles, view-the-realm dismissal,
and a working New game that returns to the start screen."
```

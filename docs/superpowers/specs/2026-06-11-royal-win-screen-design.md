# Royal Win Screen — Design

**Date:** 2026-06-11
**Status:** Approved (user delegated design decisions; theme feedback: "themed like the winner is the king of the kingdom", banners in the winner's color, fun stats for everyone)

## Goal

Replace the bare `GameOverBanner` ("{name} wins!") with a royalty-themed end-of-game
screen: the winner is crowned sovereign, every player receives a court title earned
from their in-game stats, and the final board remains inspectable.

## Components

### 1. `src/engine/scoring/summary.ts` — pure game summary (new)

`gameSummary(state: GameState): GameSummary` — derives everything the screen shows
from `GameState` (players, board, awards, log). No UI dependencies; unit-tested.

```ts
interface GameSummary {
  winner: number;                    // seat
  standings: PlayerSummary[];        // sorted by total VP desc, then seat asc
}
interface PlayerSummary {
  seat: number;
  name: string;
  color: string;
  rank: number;                      // 1-based, ties share the better rank
  totalVp: number;                   // includes hidden VP dev cards (game is finished)
  breakdown: { settlements: number; cities: number; vpCards: number;
               largestArmy: boolean; longestRoad: boolean };
  title: { text: string; detail: string };  // court title + the stat that earned it
}
```

**VP breakdown** comes from `board.buildings`, `awards`, and `devCards` (count of
`victoryPoint` cards) — mirrors `totalVictoryPoints`.

**Court titles.** Metrics counted from `state.log` and player state:

| Priority | Metric | Title | Detail format |
|---|---|---|---|
| 1 | `knightsPlayed` | Lord Commander of the Army | N knights led to battle |
| 2 | `longestRoadLength` | Warden of the King's Roads | road of N segments |
| 3 | `proposeTrade` + `tradeBank` log entries | Master of Coin | N deals brokered |
| 4 | `buyDevCard` log entries | Court Wizard | N scrolls studied |
| 5 | `steal` log entries (as thief) | Shadow of the Realm | N daring heists |
| 6 | `roll` entries with sum 7 | Herald of Misfortune | rolled N sevens |
| 7 | `discard` entries, summed `count` | Martyr of the Treasury | N cards tithed |
| 8 | buildings built (`buildSettlement` + `buildCity` + `setupSettlement` logs) | Master Builder of the Realm | N works raised |

Assignment: walk titles in priority order; each goes to the **non-winner** with the
strict maximum metric (must be > 0; ties broken by lower seat). Each player gets at
most one title. Non-winners left without a title get a rank fallback:
2nd → *Heir to the Throne*, 3rd → *Royal Chancellor*, last → *Court Jester*
(details: "the realm's second choice", "keeper of the royal ledgers", "beloved by
the court all the same"). In a 3-player game 3rd place is last → Court Jester.
The winner's title is always *Sovereign of Catan* (detail: "first of their name").

### 2. `src/ui/overlays/WinScreen.tsx` — the screen (replaces `GameOverBanner.tsx`)

- Renders `null` unless `state.phase === "finished" && state.winner !== undefined`.
- Full-viewport fixed overlay (dimmed backdrop) containing a modal card styled like
  the existing dialogs but wider (`min(94vw, 520px)`).
- **Heraldry:** a row of pennant banners (CSS `clip-path` triangles) in the winner's
  player color hanging from the card's top edge; subtle drop-in animation.
- **Crown:** inline SVG crown in `--gold` above the headline.
- **Headline:** "Long live {Name}!" + subtitle "Sovereign of Catan · {N} victory points".
- **Standings:** one row per player (rank, color swatch, name, total VP, court title
  + detail, breakdown chips: ⌂ settlements, ◆ cities, VP cards, army/road badges).
  Winner's row is visually elevated (gold edge).
- **Actions:**
  - *View the realm* (ghost) — hides the overlay; a small fixed "👑 Results" pill
    appears (bottom center) to reopen it. Local component state only.
  - *New game* (primary) — clears local persistence (`LocalStoragePersistence`)
    and navigates to the start screen (`location.hash = "#/"` + reload so the App
    remounts cleanly for both local and online games).

### 3. Integration

- `GameView` swaps `<GameOverBanner />` for `<WinScreen />`; `GameOverBanner.tsx`
  and its `.game-over` CSS are deleted.
- New styles appended to `src/ui/styles.css` using existing tokens (`--panel`,
  `--gold`, `--panel-edge`); player banner color comes from `player.color` via an
  inline CSS custom property.

## Error handling

- Engine guarantees `winner` is set when `phase === "finished"`; the component
  guards anyway and renders nothing if not.
- `gameSummary` tolerates empty/missing logs (all metrics 0 → fallback titles).

## Testing

- `tests/engine/summary.test.ts` (or alongside existing engine test layout):
  standings order, hidden VP revealed in totals, breakdown math, title priority,
  tie-breaking, winner exclusion, fallback titles, empty-log safety.
- Component test for `WinScreen`: hidden pre-finish, winner headline, standings
  rendered, View-the-realm hides + Results pill reopens. "New game" navigation is
  exercised via a click that asserts persistence cleared (reload mocked).

## Out of scope

- Lobby/joining improvements, Firebase game TTL (tracked separately).
- Rematch-with-same-players for online games (New game just returns to start).
- Confetti/particle libraries — CSS-only flourish.

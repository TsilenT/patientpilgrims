# Hidden VP Cards & Pre-Roll Dev Cards — Design Spec

**Date:** 2026-06-07
**Status:** Approved (pre-implementation)
**Builds on:** the Phase 1 rules engine and Phase 2 UI. Found during a rules audit against base-game Catan.

Two base-game fidelity fixes:

1. **Victory-point dev cards are hidden.** Today `player.victoryPoints` folds VP cards in, and
   the opponent bar shows that number — so buying a VP card visibly bumps your shown total,
   leaking hidden information. VP cards must count toward *your* win but stay invisible to
   opponents until the game ends.
2. **Any dev card may be played before the roll.** Today only Knight is pre-roll playable;
   Monopoly, Year of Plenty, and Road Building are gated to after the roll. The base game lets
   you play one dev card before *or* after rolling.

---

## 1. Goals

- Opponents never see VP that includes another player's unrevealed VP cards.
- You can always see your own true VP, broken out so the difference from the public number is
  obvious.
- VP cards still win the game (checked on your turn) and are revealed in the end-game standings.
- Monopoly / Year of Plenty / Road Building become playable in `awaitingRoll`, like Knight.
- No regression to existing rules, awards, or the win condition.

### Non-goals

Changing how *resources* or *dev-card counts* are shown (already counts-only for opponents),
any new end-game screen beyond revealing totals, or touching trading/robber/awards logic.

---

## 2. Victory points: public vs total

### Engine (`engine/scoring/victory.ts`)

- **`recomputeVictoryPoints(state, seat)`** changes to set `player.victoryPoints` to the
  **public** total only: buildings (settlement 1, city 2) + Largest Army (2) + Longest Road (2).
  It **no longer adds VP cards.** This is the single stored field opponents read, so the leak is
  removed at the source.
- **New `totalVictoryPoints(state, seat): number`** = `player.victoryPoints` + count of
  `victoryPoint` cards in that seat's `devCards`.
- **`checkVictory(state)`** uses `totalVictoryPoints(state, p.seat) >= 10` (was `p.victoryPoints`),
  so VP cards still win.
- **New `displayVictoryPoints(state, seat): number`** =
  `state.phase === "finished" ? totalVictoryPoints(state, seat) : player.victoryPoints`.
  Used by the opponent UI: public during play, full total (cards revealed) once the game ends.

`recomputeVictoryPoints` is already called wherever VP can change (build, awards, dev-card buy);
those call sites are unchanged — buying a VP card still calls it, it just no longer moves the
public number. The win check runs in `apply()` after every action via `checkVictory`, now on the
total.

### UI

- **`OpponentBar`** ([panels/OpponentBar.tsx]) reads `displayVictoryPoints(state, o.seat)` for the
  VP pill instead of `player.victoryPoints`. During play this equals the public number (no leak);
  when `finished`, it reveals each opponent's true total. `opponentView` in `state/viewModel.ts`
  gains the display VP (or the bar calls the helper directly).
- **`HandPanel`** ([panels/HandPanel.tsx]) adds a VP line for the viewing seat:
  - `total = totalVictoryPoints(state, seat)`, `public = state.players[seat].victoryPoints`,
    `cards = total - public`.
  - Renders `"{total} VP"`, and when `cards > 0`, a breakdown
    `"({public} public + {cards} from victory-point cards)"`.
  - The viewing seat's own VP cards remain listed in the dev-card list (you may see your own).

---

## 3. Pre-roll dev cards

### Engine (`engine/actions/dev.ts`)

- **`playDevCardGuard(state, type)`** changes its phase check from `requireMain` (which demands
  `subPhase === "main"`) to the same allowance Knight uses: `phase === "main"` **and**
  (`subPhase === "main"` **or** `subPhase === "awaitingRoll"`). All other guard logic is unchanged:
  - one dev card per turn (`devCardPlayedThisTurn`),
  - cannot play a card bought this turn (`boughtThisTurn`),
  - the player must hold a playable card of that type.
- This affects `applyPlayMonopoly`, `applyPlayYearOfPlenty`, `applyPlayRoadBuilding` (which call
  `playDevCardGuard`). `applyPlayKnight` already allows pre-roll and is unchanged.
- **`applyBuyDevCard` stays `requireMain`** — buying is a build-phase action (after the roll).

---

## 4. Testing

### Engine (Vitest)

- Buying a VP card: `player.victoryPoints` (public) is unchanged; `totalVictoryPoints` increases by 1.
- A player at 9 public VP who holds 1 VP card → `checkVictory` ends the game with them as winner.
- `displayVictoryPoints`: equals public mid-game, equals total once `phase === "finished"`.
- Opponent perspective (`opponentView` / display helper) for a seat holding a VP card returns the
  public number during play.
- `playMonopoly` / `playYearOfPlenty` / `playRoadBuilding` succeed when `subPhase === "awaitingRoll"`.
- Still rejected: a second dev card the same turn; a card bought this turn; after a 7 while
  `subPhase === "movingRobber"`.

### UI (RTL)

- `HandPanel` for a seat with buildings worth 5 and one VP card shows `"6 VP"` and the breakdown
  `"(5 public + 1 from victory-point cards)"`.
- `OpponentBar` for an opponent holding a VP card shows only their public VP (no bump), and shows
  the full total when `state.phase === "finished"`.

---

## 5. Files touched

| File | Change |
|---|---|
| `src/engine/scoring/victory.ts` | public-only `recomputeVictoryPoints`; add `totalVictoryPoints`, `displayVictoryPoints`; `checkVictory` uses total. |
| `src/engine/actions/dev.ts` | `playDevCardGuard` allows `awaitingRoll`. |
| `src/state/viewModel.ts` | `opponentView` (or a new helper) exposes display VP. |
| `src/ui/panels/HandPanel.tsx` | own VP line with breakdown. |
| `src/ui/panels/OpponentBar.tsx` | VP pill reads display VP. |
| `src/engine/index.ts` | export the new victory helpers if needed by the UI layer. |

---

## 6. Rollout note

`victory.ts`, `dev.ts`, `HandPanel.tsx`, and `OpponentBar.tsx` overlap with active parallel
development on another machine. Implementation `git fetch` + rebase immediately before starting
and before pushing.

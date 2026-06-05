# Phase 2 — Local-Playable UI — Design Spec

**Date:** 2026-06-05
**Status:** Approved (pre-implementation)
**Builds on:** [Async Catan design spec](2026-06-03-catan-async-design.md) §2, §3, §10; the Phase 1 rules engine (complete, 147 tests green on master).

A React + SVG user interface that makes the existing pure-TypeScript rules engine
playable **hotseat** in a single browser tab — start a game, take every seat's turn on
one device, play through to a 10-VP win. Targets the colonists.io art direction and is
responsive down to a phone. No networking, no accounts, no server (that is Phase 3).

---

## 1. Goals & scope

**In scope (Phase 2):**
- Full hotseat play of the base game on top of the engine: setup draft, rolling,
  production, building, robber/7 (discards + steal), all five dev cards, bank/port and
  player trades, both awards, victory.
- colonists.io-style art direction (flat hexes, ocean background, bold resource icons,
  white pip discs), implemented in CSS + SVG (no external art assets beyond simple icons).
- Responsive layout: desktop grid (opponents top, board center, hand + actions bottom,
  log/trade right rail) reflowing to a bottom-sheet-with-tabs on a phone.
- Local persistence: the in-progress game auto-saves and survives a page refresh.

**Out of scope (deferred to Phase 3 or later):** Firebase / networking, accounts or
secret-link seat claiming, real per-seat hidden information enforced server-side, undo,
in-app chat, animations beyond light feedback, AI opponents.

**Done when:** a complete 3–4 player game can be played hotseat in the browser from the
start screen to a win, on desktop and phone, with the game surviving a refresh.

## 2. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Phase 2 fidelity | **The works** — functional + colonists.io art + responsive, all in this phase (sequenced internally: working board → art layer → responsive reflow, so there is always a playable build). |
| Hidden information | **Perspective-based** — the UI always renders from one **`viewingSeat`**: that seat's hand/dev cards in full, opponents as counts only. |
| Why perspective-based | Phase 3 (each player on their own secret link) needs exactly this per-seat view. Building it now means **zero UI redesign** for Phase 3 — only *where `viewingSeat` comes from* changes. |
| Multi-seat on one device | A **"Pass the device to [Name]"** interstitial gates a change of viewing seat (private hands). |
| Persistence | **localStorage**, behind an async `Persistence` interface that Phase 3 swaps for Firebase with no other changes. |
| State management | **Thin custom `GameStore`** wrapping the engine's `apply()`; React binds via `useSyncExternalStore`. Only new runtime dependency is React. |
| Board rendering | **SVG**, driven by the geometry layer's existing pixel-coordinate helpers (`hexPixel` / `vertexPixel` / `edgePixel`). |

## 3. Architecture

Three new layers on top of the **unchanged** engine and board packages:

```
app/      start-game screen, resume, routing, mounts the game
ui/       React components — SVG board + panels + overlays
state/    GameStore (wraps apply) + Persistence interface
          └─ localStorage impl now; Firebase swaps in for Phase 3
engine/   (existing, unchanged — apply / createInitialGame / topology / types)
board/    (existing, unchanged — geometry + pixel coords)
```

The engine never imports React; the UI never re-implements rules. The UI reflects
`turn.subPhase` and the engine's accept/reject results, nothing more.

### 3.1 `GameStore` (framework-agnostic, plain TS)

- Holds the current `GameState` in memory.
- `dispatch(action): { ok: true } | { ok: false; error: string }` — calls
  `apply(state, action, rng)` with a `cryptoRng`. On success: swaps in the new state,
  calls `persistence.save(state)`, notifies subscribers. On failure: returns the engine's
  error string; state is untouched and no save/notify occurs.
- `getState(): GameState`
- `subscribe(cb): () => void`
- Construction seeds initial state (from `createBoard` + `createInitialGame`) or a loaded
  state.

### 3.2 `Persistence` interface (the Phase-3 seam)

Async so a Firebase implementation drops in unchanged:

```ts
interface Persistence {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
}
```

Phase 2 ships a `LocalStoragePersistence` (one JSON blob under a fixed key). `save` is
wrapped in try/catch; failures are non-fatal (logged, play continues). `load` returning a
malformed/absent blob → treated as "no game," falling back to the start screen.

### 3.3 React binding

A single `GameProvider` + `useGame()` hook built on `useSyncExternalStore`, exposing
`{ state, dispatch }` (and the derived view-model values from §4). No external state
library.

## 4. View model & game flow

### 4.1 Start / resume

Start screen: choose 3–4 players (name + color), pick board mode (**random** or
**beginner**), press Start → `createBoard({ mode })` → `createInitialGame(players, board)`
→ store seeded → persisted. If `persistence.load()` returns an in-progress game, the
screen instead offers **Resume** (and a New Game that clears the save).

### 4.2 `viewingSeat`

Pure UI state (never in `GameState`). The viewing seat sees its own resources and dev
cards in full; every opponent renders as **counts only** (resource count, dev-card count,
VP, knights played, longest-road length, award icons).

### 4.3 Current actor → viewing seat → pass interstitial

Most of the time the only actor is `turn.activeSeat`. Two engine-modeled situations pull
in other seats:

- **A 7's discards** — every seat over 7 cards owes a discard (`discardObligations`). The
  app walks the owing seats one at a time.
- **A trade acceptance** — an opponent choosing to accept a posted offer.

The app derives a **current actor** (an owing-discarder if any are pending, else the
active player) and sets `viewingSeat` to them. When the actor changes to a **different
person**, a **`PassDeviceScreen`** ("Pass the device to [Name]", tap to reveal) gates the
reveal of private cards. Within one person's continuous stretch, no interstitial appears.

**Trades in hotseat** are the one awkward case (private hands + a different seat
accepting). Default flow: a posted offer shows in the right rail; if an opponent wants it,
the active player taps "let [Name] respond," triggering a pass to that seat → they
accept/decline on their own view → pass back. Rarely used, faithful to the privacy model,
and free in Phase 3 (everyone is already on their own device).

### 4.4 `subPhase` drives the UI mode

The UI is a thin reflection of the engine's `turn.subPhase`; it never decides legality
itself.

| subPhase / condition | UI mode |
|---|---|
| `awaitingRoll` | Roll button (knight also playable before the roll) |
| `main` | build / trade / buy + play dev card / end turn |
| `movingRobber` | board prompts a robber-hex pick, then a steal-target pick |
| discard owed (`discardObligations`) | discard modal for the owing seat |
| `setupSettlement` / `setupRoad` | board highlights legal placements |
| `finished` | game-over banner with the winner |

## 5. Components

**Board — one `<svg>`** (`viewBox` from geometry bounds), drawn in layers:
- `HexTile` ×19 — colored hex, resource icon, number token on a white pip disc (6/8
  emphasized); the robber is drawn on its hex.
- `PortMarker` — 2:1 / 3:1 icons at port edges.
- `EdgeSlot` ×72 — road slots: render placed roads in owner color; highlight legal ones
  during road placement; click → `buildRoad` / `setupRoad` / road-building placement.
- `VertexSlot` — settlement/city spots: render buildings; highlight legal ones during
  placement; click → `buildSettlement` / `buildCity` / `setupSettlement`.
- Slots are interactive **only** in the matching subPhase; otherwise the board is inert.

**Top — `OpponentBar`:** a badge per opponent — name/color, resource count, dev-card
count, VP, knights, longest-road length, award icons (largest army / longest road), and a
"whose turn" highlight.

**Bottom — `HandPanel` + `ActionBar`:**
- `HandPanel` — the viewing seat's actual resources and dev cards (playable ones
  highlighted).
- `ActionBar` — context buttons per subPhase: Roll · Build · Buy Dev · Trade · End Turn;
  disabled when not the viewing seat's turn or unaffordable (reflecting the engine, not
  guessing).

**Right rail — `LogRail` + `TradePanel`:**
- `LogRail` — the engine's `log[]` rendered as readable event lines.
- `TradePanel` — open offers (accept / cancel) + a propose-trade composer.

**Overlays (each maps to a subPhase or action):**
- `PassDeviceScreen` — reveal gate on a viewing-seat change.
- `DiscardModal` — choose cards to discard; count enforced against the obligation.
- `RobberFlow` — pick a hex on the board, then a steal target (modal when multiple
  eligible).
- `BankTradePanel` — bank/port trade at the auto-computed best ratio (4:1 / 3:1 / 2:1).
- Dev-card pickers — monopoly (pick a resource), year of plenty (pick two); road building
  reuses the board placement; knight routes into `RobberFlow`.
- `GameOverBanner` — the winner.

## 6. Art direction & responsive layout

**colonists.io look** in CSS + SVG: flat hexes with a subtle border, ocean-blue
background behind the board, bold flat resource icons, number tokens as white discs with
red pips. Player colors drive roads, buildings, and badges; a city is a larger/upgraded
glyph. Light motion only: a dice-roll result flash and a brief "robber moved" highlight —
no heavy animation this phase.

**Desktop layout:** CSS grid — opponents top, board center, hand + action bar bottom,
log/trade right rail.

**Phone layout:** the board stays centered and the side/bottom chrome collapses into a
**bottom sheet with tabs** (Hand · Trades · Log), with the action bar pinned above it.
Pure CSS breakpoints; the SVG `viewBox` makes the board scale for free.

## 7. Error handling

- Every action flows through `dispatch` → `apply`. A rejected action returns the engine's
  error string, leaves state untouched, and surfaces a transient toast (e.g. "Road must
  connect to your network").
- Because the board only *offers* legal slots and the action bar disables illegal/
  unaffordable actions, most errors are prevented before a click — the toast is the
  backstop for the rest.
- `Persistence.save` / `load` are wrapped in try/catch: a failed save is non-fatal; a
  corrupt or absent load falls back to the start screen.

## 8. Testing

Vitest + React Testing Library, matching the parent spec's "lighter UI tests" stance. The
engine's 147 rules tests remain the rules safety net; UI tests cover wiring and
interaction only, never re-testing rules.

- **`GameStore` unit tests** (no React) — dispatch success/failure, persistence
  round-trip, subscriber notification.
- **Component/interaction tests** for the key flows — render a seeded `GameState` and
  assert: the board highlights legal slots; a click dispatches the right action; the pass
  screen gates a seat change; the discard modal enforces the count; game-over shows the
  winner.
- **One UI end-to-end-ish test** driving a small scripted game through the store to a win
  and asserting the banner — the UI mirror of the engine's scenario test.

## 9. Toolchain & deployment

- Add **Vite + React + TypeScript** and **React Testing Library** to the existing
  Node/Vitest setup; an `index.html` entry mounts `app/`.
- New scripts: `dev` (Vite dev server), `build` (production bundle), `preview`. Existing
  `test:run` / `typecheck` continue to cover engine + UI.
- Deployment (GitHub Actions → GitHub Pages) is wired in Phase 3 alongside networking; a
  local production `build` is verified in Phase 2 but the Pages workflow is not required
  yet.

## 10. Out of scope (explicit)

Networking / Firebase, accounts, secret-link seat claiming, server-enforced hidden
information, undo, chat, AI opponents, heavy animation, spectator mode. The hotseat
`viewingSeat` model is deliberately the same shape Phase 3 will reuse, so none of the view
work is throwaway.

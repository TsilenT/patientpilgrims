# Knight Card + Largest Army (Phase 1c-iv)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Play the Knight development card (move robber + steal, reusing the existing robber action) and award **Largest Army** (+2 VP) to the first player with ≥3 played knights, transferring it when another player exceeds the holder.

**Architecture:** A `playKnight` action consumes a knight (one-per-turn, not-same-turn — but, unlike other dev cards, playable **before or after** the roll), bumps `player.knightsPlayed`, updates the Largest-Army award, and enters the existing `movingRobber` sub-phase. A new `Turn.robberReturn` records where `moveRobber` should return to (`"main"` after a normal turn / a 7; `"awaitingRoll"` when a knight is played before rolling). `recomputeVictoryPoints` gains +2 for the Largest-Army holder.

**Scope:** Knight + Largest Army only. Depends on 1c-i (robber) and 1c-iii (`playDevCardGuard`). Reference spec §7.

---

## Context (engine on master, after 1c-iii)
- `src/engine/types.ts`: `Player.devCards`, `Turn { activeSeat, subPhase, dice?, setupSettlement?, devCardPlayedThisTurn? }`, `SubPhase` incl. `"movingRobber"`, `Action`, `LogEntry`.
- `src/engine/actions/dev.ts`: `playDevCardGuard(state, type)` — gates main phase + one-per-turn + not-bought-this-turn, and marks the card played. (Knight needs a variant that also allows `awaitingRoll`; see Task 3.)
- `src/engine/actions/roll.ts`: on a 7 → `subPhase = "movingRobber"` (and records discard obligations).
- `src/engine/actions/robber.ts`: `applyMoveRobber(state, hex, victim, rng)` — currently ends with `state.turn.subPhase = "main"`.
- `src/engine/scoring/victory.ts`: `recomputeVictoryPoints(state, seat)` = buildings + held VP cards.
- `src/engine/apply.ts`: `route` switch; runs `checkVictory` after each action.

### Environment
Windows; node/npm/npx on PATH; `npm run test:run`, `npm run typecheck`. Strict tsconfig. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File structure
- Modify `types.ts` — `Player.knightsPlayed`, `GameState.awards`, `Turn.robberReturn`, `Action` + `LogEntry`.
- Modify `state.ts` — seed `knightsPlayed: 0` per player and `awards: {}`.
- Modify `scoring/victory.ts` — add Largest-Army +2.
- Modify `roll.ts` — set `robberReturn: "main"` on a 7.
- Modify `robber.ts` — return to `robberReturn`.
- Create `src/engine/actions/knight.ts` (or extend `dev.ts`) — `applyPlayKnight` + Largest-Army update helper.
- Modify `apply.ts` — route `playKnight`.
- Create `tests/engine/knight.test.ts`.

---

## Task 1: Data model + Largest-Army scoring
- [ ] **types.ts:** add `knightsPlayed: number;` to `Player`; add `export interface Awards { largestArmy?: number; longestRoad?: number }` and `awards: Awards;` to `GameState`; add `robberReturn?: SubPhase;` to `Turn`.
- [ ] **state.ts:** in each player object add `knightsPlayed: 0,`; in the returned state add `awards: {},`.
- [ ] **scoring/victory.ts:** extend `recomputeVictoryPoints` to add the army bonus:
```ts
export function recomputeVictoryPoints(state: GameState, seat: number): void {
  const player = state.players[seat]!;
  let vp = victoryPointsFromBuildings(state, seat);
  for (const c of player.devCards) if (c.type === "victoryPoint") vp += 1;
  if (state.awards.largestArmy === seat) vp += 2;
  player.victoryPoints = vp;
}
```
- [ ] **Test** `tests/engine/knight.test.ts` (use the same helpers pattern as other engine tests): a player set as `awards.largestArmy` gets +2 on recompute; clearing it removes the +2.
- [ ] Run → pass; commit `feat(engine): knightsPlayed, awards, Largest-Army scoring`.

> Note: adding required fields `knightsPlayed`/`awards` means every game must seed them — `createInitialGame` does. Don't make them optional.

## Task 2: moveRobber returns to robberReturn; a 7 sets it to "main"
- [ ] **roll.ts:** in the `sum === 7` branch, set `state.turn.robberReturn = "main";` before `state.turn.subPhase = "movingRobber";`.
- [ ] **robber.ts:** replace the final `state.turn.subPhase = "main";` in `applyMoveRobber` with:
```ts
  state.turn.subPhase = state.turn.robberReturn ?? "main";
  delete state.turn.robberReturn;
```
- [ ] **Test:** the existing robber suite must still pass (a 7 → move → back to `"main"`). Add one test asserting `robberReturn` is consumed (undefined after moveRobber). Run full suite (the prior robber tests are the regression guard) + typecheck; commit `refactor(engine): moveRobber returns to robberReturn`.

## Task 3: playKnight
- [ ] **types.ts:** `Action` += `| { type: "playKnight" }`; `LogEntry.type` += `"playKnight"`.
- [ ] **dev.ts:** add a knight-aware guard (allows `awaitingRoll` as well as `main`):
```ts
export function playKnightGuard(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main" && state.turn.subPhase !== "awaitingRoll")
    return "You can only play a knight before or after rolling";
  if (state.turn.devCardPlayedThisTurn) return "You already played a development card this turn";
  const player = state.players[state.turn.activeSeat]!;
  const card = player.devCards.find((c) => c.type === "knight" && !c.played && !c.boughtThisTurn);
  if (!card) return "You have no playable knight card";
  card.played = true;
  state.turn.devCardPlayedThisTurn = true;
  return null;
}
```
- [ ] **Create `src/engine/actions/knight.ts`:**
```ts
import type { GameState } from "../types";
import { playKnightGuard } from "./dev";
import { recomputeVictoryPoints } from "../scoring/victory";

/** Update Largest Army after a knight is played; returns seats whose VP changed. */
function updateLargestArmy(state: GameState, seat: number): void {
  const me = state.players[seat]!.knightsPlayed;
  if (me < 3) return;
  const holder = state.awards.largestArmy;
  const holderCount = holder === undefined ? 0 : state.players[holder]!.knightsPlayed;
  if (holder === seat) return;
  if (me > holderCount) {
    state.awards.largestArmy = seat;
    if (holder !== undefined) recomputeVictoryPoints(state, holder);
    recomputeVictoryPoints(state, seat);
  }
}

export function applyPlayKnight(state: GameState): string | null {
  const err = playKnightGuard(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  state.players[seat]!.knightsPlayed += 1;
  updateLargestArmy(state, seat);
  state.log.push({ type: "playKnight", seat });
  state.turn.robberReturn = state.turn.subPhase; // "main" or "awaitingRoll"
  state.turn.subPhase = "movingRobber";
  return null;
}
```
- [ ] **apply.ts:** `case "playKnight": return applyPlayKnight(draft);`
- [ ] **Tests:** (a) knight after roll: `subPhase="main"` → playKnight → `movingRobber` (`robberReturn==="main"`) → moveRobber → back to `"main"`; knightsPlayed incremented. (b) knight before roll: `subPhase="awaitingRoll"` → playKnight → `movingRobber` (`robberReturn==="awaitingRoll"`) → moveRobber → back to `"awaitingRoll"`, then `rollDice` works. (c) cannot play a knight bought this turn / a second dev card same turn.
- [ ] Run → pass; commit `feat(engine): play knight (reuses robber move)`.

## Task 4: Largest Army transfer + win
- [ ] **Tests:** (a) third knight gives the player Largest Army + 2 VP. (b) an opponent reaching a strictly higher knight count steals the award (old holder loses 2, new gains 2). (c) tie does NOT steal (must exceed). (d) reaching 10 via Largest Army ends the game (`checkVictory` runs in `apply`). Build these by directly setting `knightsPlayed`/devCards then issuing `playKnight` + `moveRobber`.
- [ ] Run full suite + typecheck → green; commit `feat(engine): Largest Army award transfer`.

## Done criteria
- `playKnight` works before or after the roll, moves the robber via the existing action, and returns the turn to the correct sub-phase.
- Largest Army (+2 VP) goes to the first player at ≥3 knights and transfers only when strictly exceeded.
- Full suite + typecheck green.

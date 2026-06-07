# Hidden VP Cards & Pre-Roll Dev Cards Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement the approved 2026-06-07 spec so victory-point development cards remain hidden during play but still count for wins, and Monopoly / Year of Plenty / Road Building may be played before rolling.

**Architecture:** Keep `player.victoryPoints` as the public score and add helper functions for total/revealed display score. The engine win check uses total VP; UI opponents use display VP, while the local hand shows true VP plus a public/card breakdown.

**Tech Stack:** TypeScript, React, Vitest, React Testing Library.

---

## Source Spec

`docs/superpowers/specs/2026-06-07-vp-hidden-and-preroll-devcards-design.md`

## Pre-flight

- Start on `master` after `git pull --ff-only origin master`.
- Note: local uncommitted robber UI work was stashed as `pre-master-pull-local-robber-ui` before pulling.
- Run targeted tests during implementation, then full `npm test -- --run` at the end.

---

### Task 1: Engine scoring helpers and hidden VP win condition

**Objective:** Make stored VP public-only, add total/display helpers, and preserve VP-card win checks.

**Files:**
- Modify: `src/engine/scoring/victory.ts`
- Modify: `src/engine/index.ts`
- Modify: `tests/engine/devcards.test.ts`

**Steps:**
1. Update `recomputeVictoryPoints` so it sums buildings + largest army + longest road only; do not add `victoryPoint` dev cards.
2. Add `totalVictoryPoints(state, seat)` returning stored public VP plus unplayed/held `victoryPoint` card count in `player.devCards`.
3. Add `displayVictoryPoints(state, seat)` returning total only when `state.phase === "finished"`, otherwise public.
4. Update `checkVictory` to use `totalVictoryPoints(state, p.seat) >= 10`.
5. Export the new helpers from `src/engine/index.ts`.
6. Update tests:
   - Held VP card leaves `player.victoryPoints` unchanged but makes `totalVictoryPoints` one higher.
   - Buying a final VP at 9 public VP leaves public VP at 9 and finishes the game with the buyer as winner.
   - Add coverage for `displayVictoryPoints`: public during play, total when finished.
7. Verify with `npm test -- --run tests/engine/devcards.test.ts`.

---

### Task 2: Pre-roll non-Knight dev cards

**Objective:** Allow Monopoly, Year of Plenty, and Road Building during `awaitingRoll` without loosening other timing restrictions.

**Files:**
- Modify: `src/engine/actions/dev.ts`
- Modify: `tests/engine/play-devcards.test.ts`

**Steps:**
1. Add or reuse a guard that permits `state.phase === "main"` and `state.turn.subPhase` of either `"main"` or `"awaitingRoll"`.
2. Change `playDevCardGuard` to use that allowance while preserving:
   - one dev card per turn,
   - card not bought this turn,
   - player holds the card,
   - `movingRobber` and other subphases are rejected.
3. Leave `applyBuyDevCard` on `requireMain` so buying still requires after-roll main subphase.
4. Add tests proving `playMonopoly`, `playYearOfPlenty`, and `playRoadBuilding` succeed in `awaitingRoll`.
5. Add/keep tests proving second dev card and bought-this-turn remain rejected, and add a `movingRobber` rejection if not already covered.
6. Verify with `npm test -- --run tests/engine/play-devcards.test.ts`.

---

### Task 3: Public/display VP in view model and opponent UI

**Objective:** Opponent VP pills show public VP during play and full VP once the game is finished.

**Files:**
- Modify: `src/state/viewModel.ts`
- Modify: `src/ui/panels/OpponentBar.tsx` only if necessary after view model change
- Modify: `tests/ui/panels.test.tsx` or `tests/ui/viewModel.test.ts`

**Steps:**
1. Import `displayVictoryPoints` in `src/state/viewModel.ts`.
2. Change `opponentView(...).victoryPoints` to use `displayVictoryPoints(state, seat)`.
3. Keep `OpponentBar` reading `o.victoryPoints`; no component change should be necessary.
4. Add UI or view-model tests:
   - Opponent with public 5 and one VP card shows `5 VP` while `phase === "main"`.
   - Same opponent shows `6 VP` when `phase === "finished"`.
5. Verify with the chosen targeted test command.

---

### Task 4: Own-hand VP summary and breakdown

**Objective:** The viewing player can see their true VP and understand which points are hidden from opponents.

**Files:**
- Modify: `src/ui/panels/HandPanel.tsx`
- Modify: `tests/ui/handpanel.test.tsx`
- Modify: `src/ui/styles.css` only if minimal styling is needed

**Steps:**
1. Import `totalVictoryPoints` in `HandPanel`.
2. Compute `publicVp = me.victoryPoints`, `totalVp = totalVictoryPoints(state, seat)`, `cardVp = totalVp - publicVp`.
3. Render a line with accessible label/test id, e.g. `<div className="vp-summary" data-testid="hand-vp-summary">{totalVp} VP ...</div>`.
4. If `cardVp > 0`, append exactly `({publicVp} public + {cardVp} from victory-point cards)`.
5. Add RTL test for a viewing seat with public 5 and one VP card showing `6 VP` and the breakdown.
6. Verify with `npm test -- --run tests/ui/handpanel.test.tsx`.

---

### Task 5: Final integration verification

**Objective:** Ensure the complete spec works and no existing test coverage regressed.

**Files:**
- No planned source changes unless verification exposes bugs.

**Steps:**
1. Run `npm test -- --run tests/engine/devcards.test.ts tests/engine/play-devcards.test.ts tests/ui/handpanel.test.tsx tests/ui/panels.test.tsx tests/ui/viewModel.test.ts`.
2. Run full test suite with `npm test -- --run`.
3. Inspect `git diff --stat` and `git diff --check`.
4. Leave the repo ready for review; do not pop the pre-existing robber UI stash unless asked.

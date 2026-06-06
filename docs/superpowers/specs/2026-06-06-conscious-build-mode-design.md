# Conscious Build Mode — Design Spec

**Date:** 2026-06-06
**Status:** Approved (pre-implementation)
**Builds on:** Phase 2 UI ([2026-06-05-phase2-ui-design.md](2026-06-05-phase2-ui-design.md)) and the existing board interaction (`GameView`, `Slots`, `legalTargets`).

A deliberate, two-step build interaction that replaces today's direct-tap board. The player
**selects what to build first**, then the board lights up **only that type's** legal spots
as ghosts with **large tap targets**. Fixes two real problems — especially on touch: tiny
hit targets (8px vertices / 7px road lines) and the ambiguity of having settlement *and*
road targets live at the same time (a tap near an intersection builds the wrong thing).

---

## 1. Goals & constraints

- **No accidental builds.** In the neutral state the board is read-only; nothing builds
  until the player has explicitly chosen a build type.
- **Easy to hit.** Only one target type is active at a time, so each ghost can carry a
  generous invisible hit zone (~20px) without overlapping a neighbour of a different type.
- **Unified across devices.** One interaction path on desktop and touch (decided during
  brainstorming) — simpler to build and test; the extra click is trivial with a mouse.
- **Exit after each placement.** Placing a piece returns to neutral; building again means
  re-selecting the type. Most accident-proof, matching the "conscious" goal.

### Non-goals (YAGNI)

A separate confirm-after-place step (selecting the type *is* the deliberate step; big
targets handle precision), drag-to-place, multi-place-without-reselect, a touch-only second
code path, any change to the robber/steal or trade flows.

---

## 2. Interaction model

### States

A single UI state in `GameView` (sibling to the existing `roadEdges` / `devModal` state):

```ts
type BuildMode = "road" | "settlement" | "city" | null;
```

- **Neutral (`null`):** board is read-only. Action bar shows the build selector (main phase)
  or Roll (awaitingRoll).
- **Placement (`road` | `settlement` | `city`):** board shows only that type's ghosts with
  enlarged hit zones. Action bar shows a placement prompt + **Cancel**.

### Flow — main phase

1. Neutral. Action bar shows **🛣️ Road · 🏠 Settlement · 🏙️ City**, plus the existing Buy
   Dev Card / End Turn (and the trade panel as today). Each build button is enabled **only
   when it is both affordable and has ≥1 legal target**; otherwise disabled.
2. Tap a build button → `buildMode` set → board shows that type's ghosts → action bar
   switches to "Tap a spot to build a {type}" + **Cancel**.
3. Tap a ghost → dispatch the build action (`buildRoad` / `buildSettlement` / `buildCity`)
   → on success `buildMode = null` (back to neutral). On engine rejection: existing toast;
   stay in placement mode so the player can pick another spot.
4. **Cancel** → `buildMode = null`, no build.

### Flow — setup phase

The sub-phase already forces the type, so placement mode is entered **automatically**:

- `setupSettlement` → `buildMode = "settlement"`.
- `setupRoad` → `buildMode = "road"`.

No selector; the player just taps a ghost. After placing a settlement the engine advances
to `setupRoad`, which auto-switches the mode. The bigger hit zones apply here too. There is
no Cancel in setup (the placement is mandatory).

### Robber (`movingRobber`)

Unchanged. Hex pick remains a direct tap on the hex overlay (already a large target) and the
steal-victim picker is unchanged.

---

## 3. Legal targets per build type

`legalTargets(state)` today returns a combined `{ vertices, edges, hexes }` for the current
sub-phase. The main-phase branch mixes legal new-settlement vertices, legal road edges, and
upgradeable settlements together. Split these so each mode shows exactly its own ghosts:

```ts
// state/legalTargets.ts
export function buildTargets(state, mode: "road" | "settlement" | "city"): LegalTargets
```

- **road:** legal road edges (main: connectivity + empty; setup: edges off the just-placed
  settlement). Reuses the existing edge logic.
- **settlement:** legal new-settlement vertices (distance rule + on your network in main;
  any distance-legal vertex in setup).
- **city:** your own `settlement` vertices (upgrade targets).

The current `legalTargets` stays for setup/robber highlight composition; `buildTargets`
derives the per-mode set GameView feeds to the board. The Road Building dev card continues
to use `legalRoadBuildingEdges`.

---

## 4. Affordability & selector enablement

A build button is **enabled** iff `affordable(type) && buildTargets(state, type).size > 0`.

- `affordable` compares the active player's resources against `COSTS` (already exported from
  the engine): road = wood+brick, settlement = wood+brick+sheep+wheat, city = 2 wheat+3 ore.
- Disabling a mode with no legal target prevents entering an empty placement state.

Affordability is a UI affordance only; the engine remains the source of truth and rejects
anything illegal (surfaced via the existing toast).

---

## 5. Hit targets (the "bigger accepted area")

In `Slots`, only the **active** build type's ghosts are rendered interactive. Each gains a
large invisible hit shape over its small visible marker:

- **Vertex (settlement/city):** keep the visible ghost disc (~r8 / city upgrade marker on a
  settlement), add a transparent `circle` of ~r20 as the click target.
- **Edge (road):** keep the visible thin ghost line, add a transparent stroke band ~20px
  wide along the same segment as the click target.

Because only one type is live, these enlarged zones do not collide with a different-type
neighbour. Sizes are in SVG-viewBox units, so they scale up proportionally on small screens.
Non-active slots render inert (no pointer cursor, no handler).

---

## 6. Components touched

| File | Change |
|---|---|
| `state/legalTargets.ts` | Add `buildTargets(state, mode)`; unit-tested per mode. |
| `ui/GameView.tsx` | `buildMode` state; auto-set in setup; gate board handlers to the active mode; render selector vs. placement prompt; exit on success/cancel. |
| `ui/board/Slots.tsx` | Render only the active mode's ghosts; add enlarged invisible hit zones; inert otherwise. |
| `ui/panels/BuildControls.tsx` (new) | The build selector (three enable-aware buttons) and the placement prompt + Cancel; consumes `buildMode` + setters from GameView. |
| `ui/styles.css` | Selector + placement-prompt styling (dark theme); disabled/active states. |

`ActionBar` keeps Roll / Buy Dev Card / End Turn; `BuildControls` is a separate, focused
component so the build state and its UI live together.

---

## 7. Error handling

- Illegal placement (e.g. a race in online play makes a spot stale): engine rejects →
  existing toast; stay in placement mode to retry.
- Online "not your turn": the board is already read-only via the turn gate; build buttons
  are not shown when it is not your turn, so build mode is unreachable off-turn.
- Cancelling mid-placement is always available in main phase and never dispatches.

---

## 8. Testing

- **Unit (`legalTargets`):** `buildTargets` returns the right set per mode for representative
  states (main connectivity, setup, city = own settlements only, empty when none).
- **Interaction (RTL):**
  - Main phase neutral: tapping a vertex/edge builds nothing.
  - Select Road → road ghosts appear → tapping one dispatches `buildRoad` → mode exits.
  - Select Settlement / City likewise; City targets only own settlements.
  - Build buttons disabled when unaffordable or no legal target.
  - Cancel exits without building.
  - Setup: auto road/settlement mode, placement works, advances correctly.
- **Regression:** existing interaction tests that direct-tapped in the main phase are updated
  to select the type first; setup/robber/dev-card/online-turn tests stay green.

---

## 9. Rollout note

This touches `Slots.tsx`, `GameView.tsx`, and `interaction.test.tsx` — files under active
parallel development on another machine. Implementation must `git fetch` and rebase
immediately before starting, and again before pushing, to avoid clobbering concurrent work.

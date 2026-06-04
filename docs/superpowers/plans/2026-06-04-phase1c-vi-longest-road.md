# Longest Road (Phase 1c-vi)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Compute each player's longest continuous road (broken by opponents' buildings) and award **Longest Road** (+2 VP) to the first player reaching length ≥5, transferring it only when strictly exceeded. This is the last base-game rule — after it, the engine is feature-complete.

**Architecture:** A pure `longestRoadLength(state, seat)` does a DFS over the seat's road edges (no edge reused; cannot pass *through* a vertex holding an opponent's building, though such a vertex may be a path endpoint). `updateLongestRoad(state)` recomputes everyone's length and reassigns the award; it runs after any action that adds a road or a settlement (a new settlement can sever an opponent's road). `recomputeVictoryPoints` gains +2 for the holder.

**Scope:** Longest Road only. Depends on 1c-iv (`GameState.awards` with `longestRoad?`, and the recompute pattern). Reference spec §7.

---

## Context (engine on master, after 1c-iv)
- `src/engine/board.ts`: `topology()` → `edgeIds`, `vertexEdges: Map<v, edgeId[]>`, `edgeVertices: Map<e, [v,v]>`.
- `src/engine/types.ts`: `BoardState.roads: Record<edgeId,{owner}>`, `.buildings: Record<vertexId,{owner,type}>`; `GameState.awards: Awards` (`{ largestArmy?, longestRoad? }` from 1c-iv); `Player`.
- `src/engine/scoring/victory.ts`: `recomputeVictoryPoints(state, seat)` already folds buildings + VP cards + Largest Army (+2 when `awards.largestArmy === seat`).
- Handlers that change roads/junctions: `actions/build.ts` `applyBuildRoad`, `applyBuildSettlement`; `actions/dev.ts` `applyPlayRoadBuilding`.

### Environment
Windows; node/npm/npx on PATH; `npm run test:run`, `npm run typecheck`. Strict tsconfig. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File structure
- Modify `types.ts` — `Player.longestRoadLength`.
- Modify `state.ts` — seed `longestRoadLength: 0`.
- Create `src/engine/scoring/roads.ts` — `longestRoadLength`, `updateLongestRoad`.
- Modify `scoring/victory.ts` — add Longest-Road +2.
- Modify `actions/build.ts` + `actions/dev.ts` — call `updateLongestRoad` after placing roads/settlements.
- Create `tests/engine/longest-road.test.ts`.

---

## Task 1: `longestRoadLength` (pure DFS)
- [ ] **types.ts:** add `longestRoadLength: number;` to `Player`. **state.ts:** seed `longestRoadLength: 0,` per player.
- [ ] **Create `src/engine/scoring/roads.ts`:**
```ts
import type { GameState } from "../types";
import { topology } from "../board";

/**
 * Longest continuous road for `seat`: longest trail over the seat's road edges
 * (no edge reused). An opponent's building on a vertex breaks the road there —
 * you may not continue THROUGH it (but it can be a path endpoint).
 */
export function longestRoadLength(state: GameState, seat: number): number {
  const owns = (e: string) => state.board.roads[e]?.owner === seat;
  const blocked = (v: string) => {
    const b = state.board.buildings[v];
    return b !== undefined && b.owner !== seat;
  };
  const other = (e: string, v: string) => {
    const [a, b] = topology().edgeVertices.get(e)!;
    return a === v ? b : a;
  };
  // longest chain that LEAVES vertex v (v itself is allowed to be a blocked endpoint).
  function extend(v: string, used: Set<string>): number {
    let best = 0;
    for (const e of topology().vertexEdges.get(v) ?? []) {
      if (!owns(e) || used.has(e)) continue;
      const w = other(e, v);
      used.add(e);
      const cont = blocked(w) ? 0 : extend(w, used); // cannot pass through an opponent's building
      used.delete(e);
      best = Math.max(best, 1 + cont);
    }
    return best;
  }
  const starts = new Set<string>();
  for (const e of topology().edgeIds) {
    if (!owns(e)) continue;
    const [a, b] = topology().edgeVertices.get(e)!;
    starts.add(a);
    starts.add(b);
  }
  let best = 0;
  for (const v of starts) best = Math.max(best, extend(v, new Set()));
  return best;
}
```
- [ ] **Test** `tests/engine/longest-road.test.ts`: build small road chains by setting `state.board.roads[e] = {owner:0}` directly along a known path of edges, asserting the length. Cases: (a) a straight chain of 5 connected edges → 5; (b) a Y/branch where the longest simple trail is shorter than total edges → correct max; (c) an opponent settlement mid-chain splits it (e.g. 5 edges split 2|3 → longest 3); (d) a single isolated road → 1; (e) no roads → 0.
  - To build a connected chain deterministically: start at a vertex, repeatedly take an unused incident edge and walk to its far vertex, collecting edge ids, until you have N edges. Helper:
```ts
function chainEdges(start: string, n: number): { edges: string[]; verts: string[] } {
  const edges: string[] = []; const verts = [start]; let v = start; const used = new Set<string>();
  while (edges.length < n) {
    const e = (topology().vertexEdges.get(v) ?? []).find((x) => !used.has(x))!;
    used.add(e);
    const [a, b] = topology().edgeVertices.get(e)!; const w = a === v ? b : a;
    edges.push(e); verts.push(w); v = w;
  }
  return { edges, verts };
}
```
  (This is real, working test scaffolding — include it in the test file.)
- [ ] Run → pass; commit `feat(engine): longest-road length computation`.

## Task 2: Longest-Road award + VP + wiring
- [ ] **scoring/victory.ts:** extend `recomputeVictoryPoints` — after the Largest-Army line add:
```ts
  if (state.awards.longestRoad === seat) vp += 2;
```
- [ ] **scoring/roads.ts:** add the award updater:
```ts
import { recomputeVictoryPoints } from "./victory";

export function updateLongestRoad(state: GameState): void {
  const lens = state.players.map((p) => (p.longestRoadLength = longestRoadLength(state, p.seat)));
  const prev = state.awards.longestRoad;
  let current = prev;
  if (current !== undefined && lens[current]! < 5) current = undefined; // holder's road got cut below 5
  const max = Math.max(0, ...lens);
  if (max < 5) {
    current = undefined;
  } else {
    const leaders = state.players.filter((p) => lens[p.seat] === max).map((p) => p.seat);
    if (current === undefined) {
      if (leaders.length === 1) current = leaders[0]; // unowned: assign only to a sole leader
    } else if (max > lens[current]! && leaders.length === 1) {
      current = leaders[0]; // a sole challenger strictly exceeds the holder
    }
    // ties, or holder still tied-for-max, leave the award where it is
  }
  if (current !== prev) {
    if (current === undefined) delete state.awards.longestRoad;
    else state.awards.longestRoad = current;
    if (prev !== undefined) recomputeVictoryPoints(state, prev);
    if (current !== undefined) recomputeVictoryPoints(state, current);
  }
}
```
- [ ] **Wire `updateLongestRoad(state)` in:**
  - `actions/build.ts` `applyBuildRoad` — after `state.board.roads[edge] = ...` (and after the existing `recomputeVictoryPoints`/log). Import `updateLongestRoad` from `../scoring/roads`.
  - `actions/build.ts` `applyBuildSettlement` — after placing the settlement (it may cut an opponent's road).
  - `actions/dev.ts` `applyPlayRoadBuilding` — after the placement loop.
  (No need to call it on `buildCity` — upgrading a settlement to a city changes no junctions.)
- [ ] **Tests:** (a) a player reaching a 5-road builds → gets `awards.longestRoad` and +2 VP; (b) an opponent building a longer road (≥ holder+1, sole leader) steals it (old holder loses 2, new gains 2); (c) an equal-length challenger does NOT steal; (d) an opponent settlement cutting the holder's road below 5 vacates the award; (e) winning via Longest Road (9 building/other VP + the +2) ends the game (`checkVictory` runs in `apply`).
- [ ] Run full suite + typecheck → green; commit `feat(engine): Longest Road award`.

## Task 3: Feature-complete gate
- [ ] Run `npm run test:run` (all green) and `npm run typecheck` (exit 0). The base-game rules engine is now complete: setup, production, building, robber/7, dev cards (all five), trading, Largest Army, Longest Road, 10-VP victory.
- [ ] (Optional) Extend the full-game `tests/engine/scenario.test.ts` so its `takeTurn` exercises buying/playing dev cards and trading, and replace the robber test-side scaffold with the real `moveRobber` action now that everything exists. Commit `test(engine): exercise full rule set in the game scenario`.

## Done criteria
- `longestRoadLength` correctly handles straight chains, branches, opponent-building breaks, and isolated roads.
- Longest Road (+2 VP) is awarded at ≥5, transfers only on a strict sole-leader exceed, and is vacated when the holder drops below 5.
- Full suite + typecheck green — **the base-game engine (Phase 1) is feature-complete.**

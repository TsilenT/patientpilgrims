import type { GameState } from "../types";
import { topology } from "../board";
import { recomputeVictoryPoints } from "./victory";

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

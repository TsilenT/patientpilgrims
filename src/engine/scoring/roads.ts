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

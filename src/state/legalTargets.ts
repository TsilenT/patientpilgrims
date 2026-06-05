import type { GameState } from "../engine/types";
import type { LegalTargets } from "../ui/board/layout";
import { topology } from "../engine/board";
import { respectsDistance, vertexOnNetwork, edgeConnects } from "../engine";

const EMPTY: LegalTargets = { vertices: new Set(), edges: new Set(), hexes: new Set() };

export function legalTargets(state: GameState): LegalTargets {
  const seat = state.turn.activeSeat;
  const sub = state.turn.subPhase;
  const t: LegalTargets = { vertices: new Set(), edges: new Set(), hexes: new Set() };

  if (sub === "setupSettlement") {
    for (const v of topology().vertexIds) if (respectsDistance(state.board, v)) t.vertices.add(v);
    return t;
  }
  if (sub === "setupRoad") {
    const just = state.turn.setupSettlement;
    if (just) for (const e of topology().vertexEdges.get(just) ?? [])
      if (state.board.roads[e] === undefined) t.edges.add(e);
    return t;
  }
  if (sub === "main") {
    for (const v of topology().vertexIds)
      if (state.board.buildings[v] === undefined && respectsDistance(state.board, v) && vertexOnNetwork(state.board, seat, v))
        t.vertices.add(v);
    for (const e of topology().edgeIds)
      if (state.board.roads[e] === undefined && edgeConnects(state.board, seat, e)) t.edges.add(e);
    for (const v of topology().vertexIds) {
      const b = state.board.buildings[v];
      if (b && b.owner === seat && b.type === "settlement") t.vertices.add(v);
    }
    return t;
  }
  if (sub === "movingRobber") {
    for (const h of topology().hexIds) if (h !== state.board.robber) t.hexes.add(h);
    return t;
  }
  return EMPTY;
}

import type { GameState } from "../engine/types";
import { topology } from "../engine/board";
import { respectsDistance, vertexOnNetwork, edgeConnects } from "../engine";

/** Clickable board targets for the current sub-phase. Defined here (state layer);
 *  the board UI imports this type rather than the reverse. */
export interface LegalTargets { vertices: Set<string>; edges: Set<string>; hexes: Set<string> }

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
  return t; // no targets for other sub-phases (t holds fresh empty sets)
}

/**
 * Edges legal to place during a Road Building card, treating already-collected
 * edges as if placed — so a second road that only connects via the first still
 * highlights. The engine re-validates the final pair on dispatch.
 */
export function legalRoadBuildingEdges(state: GameState, collected: string[]): Set<string> {
  const seat = state.turn.activeSeat;
  const roads = { ...state.board.roads };
  for (const e of collected) roads[e] = { owner: seat };
  const board = { ...state.board, roads };
  const result = new Set<string>();
  for (const e of topology().edgeIds) {
    if (roads[e] !== undefined) continue;
    if (edgeConnects(board, seat, e)) result.add(e);
  }
  return result;
}

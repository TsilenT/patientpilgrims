import type { BoardState } from "./types";
import { topology } from "./board";

export function isVertexEmpty(board: BoardState, v: string): boolean {
  return board.buildings[v] === undefined;
}

/** Empty, and no adjacent vertex carries a building (distance rule). */
export function respectsDistance(board: BoardState, v: string): boolean {
  if (!isVertexEmpty(board, v)) return false;
  const neighbors = topology().vertexNeighbors.get(v) ?? [];
  return neighbors.every((n) => board.buildings[n] === undefined);
}

/** True if a road owned by `seat` touches vertex `v`. */
export function vertexOnNetwork(board: BoardState, seat: number, v: string): boolean {
  const edges = topology().vertexEdges.get(v) ?? [];
  return edges.some((e) => board.roads[e]?.owner === seat);
}

/**
 * A road on `edge` connects to `seat`'s network if one of its endpoints either
 * holds `seat`'s own building, or is reached by another of `seat`'s roads and is
 * not occupied by an opponent's building (which blocks pass-through).
 */
export function edgeConnects(board: BoardState, seat: number, edge: string): boolean {
  const [a, b] = topology().edgeVertices.get(edge)!;
  for (const v of [a, b]) {
    const bld = board.buildings[v];
    if (bld) {
      if (bld.owner === seat) return true;
      continue;
    }
    for (const e of topology().vertexEdges.get(v) ?? []) {
      if (e === edge) continue;
      if (board.roads[e]?.owner === seat) return true;
    }
  }
  return false;
}

export function legalSetupSettlements(board: BoardState): string[] {
  return topology().vertexIds.filter((v) => respectsDistance(board, v));
}

export function legalSetupRoads(board: BoardState, settlementVertex: string): string[] {
  const edges = topology().vertexEdges.get(settlementVertex) ?? [];
  return edges.filter((e) => board.roads[e] === undefined);
}

export function legalSettlements(board: BoardState, seat: number): string[] {
  return topology().vertexIds.filter(
    (v) => respectsDistance(board, v) && vertexOnNetwork(board, seat, v),
  );
}

export function legalCities(board: BoardState, seat: number): string[] {
  return topology().vertexIds.filter((v) => {
    const b = board.buildings[v];
    return b !== undefined && b.owner === seat && b.type === "settlement";
  });
}

export function legalRoads(board: BoardState, seat: number): string[] {
  return topology().edgeIds.filter(
    (e) => board.roads[e] === undefined && edgeConnects(board, seat, e),
  );
}

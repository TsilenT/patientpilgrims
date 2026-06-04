import { describe, it, expect } from "vitest";
import { topology } from "../../src/engine/board";
import {
  respectsDistance, vertexOnNetwork, edgeConnects,
  legalSetupSettlements, legalCities,
} from "../../src/engine/placement";
import type { BoardState } from "../../src/engine/types";

const topo = topology();

function emptyBoard(): BoardState {
  return { tiles: {}, robber: "", ports: [], buildings: {}, roads: {} };
}

describe("placement predicates", () => {
  it("distance rule blocks the vertex and its neighbors", () => {
    const board = emptyBoard();
    const v = topo.vertexIds[0]!;
    board.buildings[v] = { owner: 0, type: "settlement" };
    expect(respectsDistance(board, v)).toBe(false);
    for (const n of topo.vertexNeighbors.get(v)!) {
      expect(respectsDistance(board, n)).toBe(false);
    }
  });

  it("a far vertex remains legal", () => {
    const board = emptyBoard();
    const v = topo.vertexIds[0]!;
    board.buildings[v] = { owner: 0, type: "settlement" };
    const blocked = new Set([v, ...topo.vertexNeighbors.get(v)!]);
    const far = topo.vertexIds.find((x) => !blocked.has(x))!;
    expect(respectsDistance(board, far)).toBe(true);
  });

  it("vertexOnNetwork and edgeConnects follow your own roads", () => {
    const board = emptyBoard();
    const v = topo.vertexIds[0]!;
    const edge = topo.vertexEdges.get(v)![0]!;
    board.roads[edge] = { owner: 0 };
    expect(vertexOnNetwork(board, 0, v)).toBe(true);
    expect(vertexOnNetwork(board, 1, v)).toBe(false);
    const other = topo.vertexEdges.get(v)!.find((e) => e !== edge)!;
    expect(edgeConnects(board, 0, other)).toBe(true);
    expect(edgeConnects(board, 1, other)).toBe(false);
  });

  it("an opponent building blocks road pass-through", () => {
    const board = emptyBoard();
    const v = topo.vertexIds[0]!;
    const e1 = topo.vertexEdges.get(v)![0]!;
    const e2 = topo.vertexEdges.get(v)!.find((e) => e !== e1)!;
    board.roads[e1] = { owner: 0 };
    board.buildings[v] = { owner: 1, type: "settlement" };
    expect(edgeConnects(board, 0, e2)).toBe(false);
  });

  it("legalCities lists only your own settlements (not cities)", () => {
    const board = emptyBoard();
    const v0 = topo.vertexIds[0]!;
    const v1 = topo.vertexIds[10]!;
    board.buildings[v0] = { owner: 0, type: "settlement" };
    board.buildings[v1] = { owner: 0, type: "city" };
    expect(legalCities(board, 0)).toEqual([v0]);
  });

  it("legalSetupSettlements starts at 54 and shrinks by the placement + neighbors", () => {
    const board = emptyBoard();
    expect(legalSetupSettlements(board)).toHaveLength(54);
    const v = topo.vertexIds[0]!;
    board.buildings[v] = { owner: 0, type: "settlement" };
    expect(legalSetupSettlements(board)).toHaveLength(
      54 - 1 - topo.vertexNeighbors.get(v)!.length,
    );
  });
});

import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { topology } from "../../src/engine/board";
import { longestRoadLength } from "../../src/engine/scoring/roads";
import type { GameState } from "../../src/engine/types";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

function baseGame(): GameState {
  return createInitialGame(players3, createBoard({ mode: "beginner" }));
}

/** Build a connected simple path of `n` edges starting at vertex `start`. */
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

describe("longestRoadLength", () => {
  it("(a) straight chain of 5 connected edges -> 5", () => {
    const g = baseGame();
    const { edges } = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of edges) g.board.roads[e] = { owner: 0 };
    expect(longestRoadLength(g, 0)).toBe(5);
  });

  it("(b) Y/branch: longest simple trail is shorter than total edge count", () => {
    // Chain of 3 edges: verts[0] -e0- verts[1] -e1- verts[2] -e2- verts[3].
    // Add a 4th edge branching off interior vertex verts[1].
    // verts[1] becomes a junction with three spokes:
    //   - e0 (arm length 1, back to verts[0])
    //   - e1+e2 (arm length 2, forward to verts[3])
    //   - branch edge (arm length 1)
    // A simple path visits the junction once and uses at most 2 spokes,
    // so the longest trail = 2 (long arm) + 1 (a short arm) = 3,
    // even though there are 4 owned edges total.
    const g = baseGame();
    const { edges, verts } = chainEdges(topology().vertexIds[0]!, 3);
    for (const e of edges) g.board.roads[e] = { owner: 0 };
    const used = new Set(edges);
    const junction = verts[1]!;
    const branch = (topology().vertexEdges.get(junction) ?? []).find((x) => !used.has(x))!;
    expect(branch).toBeDefined();
    g.board.roads[branch] = { owner: 0 };
    expect(longestRoadLength(g, 0)).toBe(3);
  });

  it("(c) opponent building mid-chain splits it; own building does not", () => {
    const g = baseGame();
    const { edges, verts } = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of edges) g.board.roads[e] = { owner: 0 };
    // Opponent settlement on interior vertex splitting 2 | 3 -> longer segment is 3.
    g.board.buildings[verts[2]!] = { owner: 1, type: "settlement" };
    expect(longestRoadLength(g, 0)).toBe(3);
    // Same vertex, but owned by the seat -> no split, full length 5.
    g.board.buildings[verts[2]!] = { owner: 0, type: "settlement" };
    expect(longestRoadLength(g, 0)).toBe(5);
  });

  it("(d) a single isolated road -> 1", () => {
    const g = baseGame();
    const { edges } = chainEdges(topology().vertexIds[0]!, 1);
    g.board.roads[edges[0]!] = { owner: 0 };
    expect(longestRoadLength(g, 0)).toBe(1);
  });

  it("(e) no roads -> 0", () => {
    const g = baseGame();
    expect(longestRoadLength(g, 0)).toBe(0);
  });
});

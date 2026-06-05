import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { topology } from "../../src/engine/board";
import { longestRoadLength, updateLongestRoad } from "../../src/engine/scoring/roads";
import { apply } from "../../src/engine/apply";
import { mulberry32 } from "../../src/engine/rng";
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

describe("updateLongestRoad award", () => {
  it("(a) reaching length 5 grants the award and +2 VP", () => {
    const g = baseGame();
    const { edges } = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of edges) g.board.roads[e] = { owner: 0 };
    updateLongestRoad(g);
    expect(g.awards.longestRoad).toBe(0);
    expect(g.players[0]!.longestRoadLength).toBe(5);
    // VP = 0 buildings + 2 for the award.
    expect(g.players[0]!.victoryPoints).toBe(2);
  });

  it("(b) a sole challenger who strictly exceeds the holder steals it", () => {
    const g = baseGame();
    // Seat 0 holds at length 5 from a chain starting at vertex 0.
    const seat0 = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of seat0.edges) g.board.roads[e] = { owner: 0 };
    updateLongestRoad(g);
    expect(g.awards.longestRoad).toBe(0);
    expect(g.players[0]!.victoryPoints).toBe(2);

    // Seat 1 builds a disjoint chain of length 6 (sole leader).
    // Start from a far-away vertex to avoid overlapping seat 0's edges.
    const seat1 = chainEdges(topology().vertexIds[30]!, 6);
    for (const e of seat1.edges) g.board.roads[e] = { owner: 1 };
    updateLongestRoad(g);
    expect(g.players[1]!.longestRoadLength).toBe(6);
    expect(g.awards.longestRoad).toBe(1);
    expect(g.players[1]!.victoryPoints).toBe(2); // gained +2
    expect(g.players[0]!.victoryPoints).toBe(0); // lost +2
  });

  it("(c) an equal-length challenger does NOT steal the award", () => {
    const g = baseGame();
    const seat0 = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of seat0.edges) g.board.roads[e] = { owner: 0 };
    updateLongestRoad(g);
    expect(g.awards.longestRoad).toBe(0);

    // Seat 1 also reaches exactly 5 (disjoint chain) -> tie, award stays with seat 0.
    const seat1 = chainEdges(topology().vertexIds[30]!, 5);
    for (const e of seat1.edges) g.board.roads[e] = { owner: 1 };
    updateLongestRoad(g);
    expect(g.players[1]!.longestRoadLength).toBe(5);
    expect(g.awards.longestRoad).toBe(0); // unchanged
    expect(g.players[0]!.victoryPoints).toBe(2);
    expect(g.players[1]!.victoryPoints).toBe(0); // no +2 for the tie
  });

  it("(d) an opponent settlement cutting the holder below 5 vacates the award", () => {
    const g = baseGame();
    const seat0 = chainEdges(topology().vertexIds[0]!, 5);
    for (const e of seat0.edges) g.board.roads[e] = { owner: 0 };
    updateLongestRoad(g);
    expect(g.awards.longestRoad).toBe(0);
    expect(g.players[0]!.victoryPoints).toBe(2);

    // Opponent settlement on an interior vertex splits 2 | 3 -> longest segment 3 (<5).
    // Place it directly, then recompute. (Distance rules aren't enforced here since
    // we're seeding board state and exercising the award logic only.)
    g.board.buildings[seat0.verts[2]!] = { owner: 1, type: "settlement" };
    updateLongestRoad(g);
    expect(g.players[0]!.longestRoadLength).toBe(3);
    expect(g.awards.longestRoad).toBeUndefined();
    expect(g.players[0]!.victoryPoints).toBe(0); // lost +2
  });

  it("wiring: a real buildRoad through apply() fires the award", () => {
    const g = baseGame();
    g.phase = "main";
    g.turn = { activeSeat: 0, subPhase: "main" };
    // Seed a connected 4-edge road for seat 0 plus a settlement at the chain
    // start so the connection check passes, then build the 5th edge via apply().
    const start = topology().vertexIds[0]!;
    const { edges, verts } = chainEdges(start, 5);
    for (const e of edges.slice(0, 4)) g.board.roads[e] = { owner: 0 };
    g.board.buildings[start] = { owner: 0, type: "settlement" };
    // The 5th edge connects to the network at verts[4] (end of the seeded chain).
    g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
    expect(verts).toHaveLength(6);

    const res = apply(g, { type: "buildRoad", edge: edges[4]! }, mulberry32(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.players[0]!.longestRoadLength).toBe(5);
    expect(res.state.awards.longestRoad).toBe(0);
    // building VP (1 settlement) + 2 award = 3.
    expect(res.state.players[0]!.victoryPoints).toBe(3);
  });

  it("(e) crossing to length 5 via apply() can win the game (checkVictory runs)", () => {
    const g = baseGame();
    g.phase = "main";
    g.turn = { activeSeat: 0, subPhase: "main" };
    const start = topology().vertexIds[0]!;
    const { edges } = chainEdges(start, 5);
    // Seed a connected 4-edge road; build the 5th through apply().
    for (const e of edges.slice(0, 4)) g.board.roads[e] = { owner: 0 };
    g.board.buildings[start] = { owner: 0, type: "settlement" };
    // Give seat 0 four cities (8 VP) at far-apart vertices so VP from buildings = 8.
    // (Use vertices well clear of the road chain; their adjacency doesn't matter
    // for VP counting.)
    const cityVerts = [
      topology().vertexIds[20]!,
      topology().vertexIds[25]!,
      topology().vertexIds[30]!,
      topology().vertexIds[35]!,
    ];
    for (const v of cityVerts) g.board.buildings[v] = { owner: 0, type: "city" };
    g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };

    const res = apply(g, { type: "buildRoad", edge: edges[4]! }, mulberry32(1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 8 (4 cities) + 1 (start settlement) + 2 (longest road) = 11 >= 10 -> win.
    expect(res.state.awards.longestRoad).toBe(0);
    expect(res.state.players[0]!.victoryPoints).toBeGreaterThanOrEqual(10);
    expect(res.state.phase).toBe("finished");
    expect(res.state.winner).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { buildTopology } from "../../src/board/topology";

describe("board topology", () => {
  const topo = buildTopology();

  it("has 19 hexes, 54 vertices, 72 edges", () => {
    expect(topo.hexIds).toHaveLength(19);
    expect(topo.vertexIds).toHaveLength(54);
    expect(topo.edgeIds).toHaveLength(72);
  });

  it("has 30 coastal (border) edges", () => {
    const border = topo.edgeIds.filter((e) => topo.edgeHexes.get(e)!.length === 1);
    expect(border).toHaveLength(30);
  });

  it("every edge connects two vertices that are also neighbor vertices", () => {
    for (const e of topo.edgeIds) {
      const [a, b] = topo.edgeVertices.get(e)!;
      expect(topo.vertexNeighbors.get(a)!).toContain(b);
      expect(topo.vertexNeighbors.get(b)!).toContain(a);
    }
  });

  it("adjacency is symmetric and bounded (vertices touch <=3 hexes, <=3 edges, <=3 neighbors)", () => {
    for (const v of topo.vertexIds) {
      expect(topo.vertexHexes.get(v)!.length).toBeLessThanOrEqual(3);
      expect(topo.vertexEdges.get(v)!.length).toBeLessThanOrEqual(3);
      expect(topo.vertexNeighbors.get(v)!.length).toBeLessThanOrEqual(3);
    }
    // center hex's 6 vertices are all interior (touch 3 hexes)
    const center = topo.hexVertices.get("0,0,0")!;
    for (const v of center) expect(topo.vertexHexes.get(v)!.length).toBe(3);
  });

  it("edge incidence accounting matches 2*interior + border = 19*6", () => {
    const interior = topo.edgeIds.filter((e) => topo.edgeHexes.get(e)!.length === 2).length;
    const border = topo.edgeIds.length - interior;
    expect(2 * interior + border).toBe(19 * 6);
  });
});

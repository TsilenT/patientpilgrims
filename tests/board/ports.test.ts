import { describe, it, expect } from "vitest";
import { placePorts, type Port } from "../../src/board/ports";
import { buildTopology } from "../../src/board/topology";
import { PORT_BAG } from "../../src/board/constants";

const topo = buildTopology();

describe("placePorts", () => {
  const ports = placePorts();

  it("places exactly 9 ports", () => {
    expect(ports).toHaveLength(9);
  });

  it("uses the full port bag", () => {
    expect(ports.map((p) => p.kind).sort()).toEqual([...PORT_BAG].sort());
  });

  it("each port is on a distinct coastal (border) edge", () => {
    const edges = new Set(ports.map((p) => p.edge));
    expect(edges.size).toBe(9);
    for (const p of ports) {
      expect(topo.edgeHexes.get(p.edge)!.length).toBe(1); // coastal
    }
  });

  it("each port references the 2 real endpoints of its edge", () => {
    for (const p of ports) {
      expect(p.vertices.length).toBe(2);
      expect(new Set(topo.edgeVertices.get(p.edge)!)).toEqual(new Set(p.vertices));
    }
  });

  it("is deterministic", () => {
    expect(placePorts()).toEqual(placePorts());
  });
});

import { describe, it, expect } from "vitest";
import { boardHexes, cubeAdd, cubeKey, DIRECTIONS, type Cube } from "../../src/board/coords";
import {
  hexVertices, hexEdges, edgeEndpoints, vertexPixel, edgePixel, hexPixel,
} from "../../src/board/coords";

describe("cube coordinates", () => {
  it("DIRECTIONS has 6 unit vectors summing to zero each", () => {
    expect(DIRECTIONS).toHaveLength(6);
    for (const d of DIRECTIONS) expect(d.x + d.y + d.z).toBe(0);
  });

  it("opposite directions cancel", () => {
    for (let i = 0; i < 6; i++) {
      const a = DIRECTIONS[i]!;
      const b = DIRECTIONS[(i + 3) % 6]!;
      expect(cubeAdd(a, b)).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("boardHexes(2) returns 19 unique hexes with x+y+z===0", () => {
    const hexes = boardHexes(2);
    expect(hexes).toHaveLength(19);
    const keys = new Set(hexes.map(cubeKey));
    expect(keys.size).toBe(19);
    for (const h of hexes) {
      expect(h.x + h.y + h.z).toBe(0);
      expect(Math.max(Math.abs(h.x), Math.abs(h.y), Math.abs(h.z))).toBeLessThanOrEqual(2);
    }
    expect(keys.has("0,0,0")).toBe(true);
  });

  it("cubeKey round-trips uniquely", () => {
    const a: Cube = { x: 1, y: -1, z: 0 };
    const b: Cube = { x: 1, y: 0, z: -1 };
    expect(cubeKey(a)).not.toEqual(cubeKey(b));
  });
});

describe("vertex/edge keys", () => {
  it("each hex yields 6 distinct vertices and 6 distinct edges", () => {
    const h = { x: 0, y: 0, z: 0 };
    expect(new Set(hexVertices(h)).size).toBe(6);
    expect(new Set(hexEdges(h)).size).toBe(6);
  });

  it("adjacent hexes share exactly 2 vertices and 1 edge", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: -1, z: 0 }; // DIRECTIONS[0] neighbor
    const sharedV = hexVertices(a).filter((v) => hexVertices(b).includes(v));
    const sharedE = hexEdges(a).filter((e) => hexEdges(b).includes(e));
    expect(sharedV).toHaveLength(2);
    expect(sharedE).toHaveLength(1);
  });

  it("each edge of a hex has 2 endpoints that are vertices of that hex", () => {
    const h = { x: 0, y: 0, z: 0 };
    const verts = new Set(hexVertices(h));
    for (let i = 0; i < 6; i++) {
      const ends = edgeEndpoints(h, i);
      expect(ends).toHaveLength(2);
      for (const v of ends) expect(verts.has(v)).toBe(true);
    }
  });

  it("pixel helpers return finite coordinates", () => {
    const h = { x: 0, y: 0, z: 0 };
    for (const p of [hexPixel(h), vertexPixel(hexVertices(h)[0]!), edgePixel(hexEdges(h)[0]!)]) {
      expect(Number.isFinite(p.px)).toBe(true);
      expect(Number.isFinite(p.py)).toBe(true);
    }
  });
});

import { describe, it, expect } from "vitest";
import { boardHexes, cubeAdd, cubeKey, DIRECTIONS, type Cube } from "../../src/board/coords";

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

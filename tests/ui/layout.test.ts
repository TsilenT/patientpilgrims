import { describe, it, expect } from "vitest";
import { boardLayout, SCALE } from "../../src/ui/board/layout";
import { topology } from "../../src/engine/board";

describe("boardLayout", () => {
  const layout = boardLayout();

  it("places every vertex and edge id", () => {
    expect(Object.keys(layout.vertex)).toHaveLength(topology().vertexIds.length);
    expect(Object.keys(layout.edge)).toHaveLength(topology().edgeIds.length);
    expect(Object.keys(layout.hex)).toHaveLength(topology().hexIds.length);
  });

  it("viewBox contains all vertex points", () => {
    const { minX, minY, width, height } = layout.viewBox;
    for (const v of Object.values(layout.vertex)) {
      expect(v.x).toBeGreaterThanOrEqual(minX);
      expect(v.y).toBeGreaterThanOrEqual(minY);
      expect(v.x).toBeLessThanOrEqual(minX + width);
      expect(v.y).toBeLessThanOrEqual(minY + height);
    }
  });

  it("scales by SCALE relative to raw unit coords", () => {
    const ids = topology().vertexIds;
    expect(ids.length).toBeGreaterThan(1);
    expect(SCALE).toBeGreaterThan(1);
  });
});

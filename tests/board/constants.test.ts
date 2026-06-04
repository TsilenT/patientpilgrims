import { describe, it, expect } from "vitest";
import {
  RESOURCES, TILE_BAG, NUMBER_BAG, PIP, PORT_BAG, type Resource,
} from "../../src/board/constants";

describe("board constants", () => {
  it("has the 5 resources", () => {
    expect([...RESOURCES].sort()).toEqual(["brick", "ore", "sheep", "wheat", "wood"]);
  });

  it("tile bag is 19 tiles with correct counts", () => {
    expect(TILE_BAG).toHaveLength(19);
    const count = (r: Resource | "desert") => TILE_BAG.filter((t) => t === r).length;
    expect(count("wood")).toBe(4);
    expect(count("sheep")).toBe(4);
    expect(count("wheat")).toBe(4);
    expect(count("brick")).toBe(3);
    expect(count("ore")).toBe(3);
    expect(count("desert")).toBe(1);
  });

  it("number bag is the 18 standard tokens", () => {
    expect([...NUMBER_BAG].sort((a, b) => a - b)).toEqual(
      [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
    );
  });

  it("pip values follow distance-from-7", () => {
    expect(PIP[2]).toBe(1);
    expect(PIP[6]).toBe(5);
    expect(PIP[8]).toBe(5);
    expect(PIP[12]).toBe(1);
    expect(PIP[7]).toBe(0);
  });

  it("port bag has 4 generic 3:1 and one 2:1 per resource", () => {
    expect(PORT_BAG).toHaveLength(9);
    expect(PORT_BAG.filter((p) => p === "any").length).toBe(4);
    for (const r of RESOURCES) expect(PORT_BAG.filter((p) => p === r).length).toBe(1);
  });
});

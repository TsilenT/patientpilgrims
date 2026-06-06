import { describe, it, expect } from "vitest";
import { randomSeed } from "../../src/state/seed";

describe("randomSeed", () => {
  it("returns a 32-bit unsigned integer", () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it("varies across calls", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => randomSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});

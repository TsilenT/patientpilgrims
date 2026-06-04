import { describe, it, expect } from "vitest";
import { mulberry32, type Rng } from "../../src/engine/rng";

describe("mulberry32 Rng", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a.nextFloat(), a.nextFloat(), a.nextFloat()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
    expect(seqA).toEqual(seqB);
  });

  it("nextFloat is in [0, 1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt(n) returns 0..n-1", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it("shuffle is a permutation and deterministic for a seed", () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = mulberry32(42).shuffle([...input]);
    const s2 = mulberry32(42).shuffle([...input]);
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual(input);
    expect(s1).not.toEqual(input); // seed 42 actually reorders
  });

  it("satisfies the Rng interface shape", () => {
    const r: Rng = mulberry32(0);
    expect(typeof r.nextFloat).toBe("function");
    expect(typeof r.nextInt).toBe("function");
    expect(typeof r.shuffle).toBe("function");
  });
});

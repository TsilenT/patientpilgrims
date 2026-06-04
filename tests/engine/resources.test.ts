import { describe, it, expect } from "vitest";
import {
  emptyResources, fullBank, totalCards, canAfford, payInto, gainInto, COSTS,
} from "../../src/engine/resources";

describe("resources", () => {
  it("emptyResources is all zero", () => {
    expect(emptyResources()).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  });

  it("fullBank is 19 of each (95 total)", () => {
    expect(totalCards(fullBank())).toBe(95);
  });

  it("canAfford respects every resource", () => {
    const have = { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 };
    expect(canAfford(have, COSTS.settlement)).toBe(true);
    expect(canAfford(have, COSTS.city)).toBe(false);
  });

  it("gainInto then payInto adjust totals", () => {
    const r = emptyResources();
    gainInto(r, { wood: 2, brick: 1, sheep: 0, wheat: 0, ore: 0 });
    expect(r.wood).toBe(2);
    payInto(r, COSTS.road);
    expect(r).toEqual({ wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  });

  it("city costs 2 wheat + 3 ore", () => {
    expect(COSTS.city).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 });
  });
});

import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng";
import { rollTurnOrder } from "../../src/engine/order";
import { createInitialGame } from "../../src/engine/state";
import { createBoard } from "../../src/board";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

/** Finds a seed where round 1 has no ties (or has them) to make assertions stable. */
function findSeed(pred: (rounds: ReturnType<typeof rollTurnOrder>["rounds"]) => boolean): number {
  for (let seed = 0; seed < 5000; seed++) {
    const { rounds } = rollTurnOrder([0, 1, 2, 3], mulberry32(seed));
    if (pred(rounds)) return seed;
  }
  throw new Error("no seed found");
}

describe("rollTurnOrder", () => {
  it("orders seats by round-1 sum, highest first, when there are no ties", () => {
    const seed = findSeed((rounds) => {
      const sums = rounds[0]!.map((r) => r.sum);
      return new Set(sums).size === 4;
    });
    const { order, rounds } = rollTurnOrder([0, 1, 2, 3], mulberry32(seed));
    expect(rounds).toHaveLength(1);
    const sumBySeat = new Map(rounds[0]!.map((r) => [r.seat, r.sum]));
    const sorted = [...order].map((s) => sumBySeat.get(s)!);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  });

  it("re-rolls only the tied seats; untied seats keep their placement", () => {
    const seed = findSeed((rounds) => {
      if (rounds.length < 2) return false;
      const sums = rounds[0]!.map((r) => r.sum);
      return new Set(sums).size === 3; // exactly one pair tied
    });
    const { order, rounds } = rollTurnOrder([0, 1, 2, 3], mulberry32(seed));
    const first = rounds[0]!;
    const sums = first.map((r) => r.sum);
    const tiedSum = sums.find((s) => sums.filter((x) => x === s).length === 2)!;
    const tiedSeats = first.filter((r) => r.sum === tiedSum).map((r) => r.seat);

    // every later round contains only seats that were tied
    for (const round of rounds.slice(1)) {
      for (const r of round) expect(tiedSeats).toContain(r.seat);
    }
    // untied seats appear in order sorted by their round-1 sums
    const untied = first.filter((r) => r.sum !== tiedSum).sort((a, b) => b.sum - a.sum).map((r) => r.seat);
    expect(order.filter((s) => untied.includes(s))).toEqual(untied);
    // the tied pair occupies adjacent positions
    const positions = tiedSeats.map((s) => order.indexOf(s)).sort((a, b) => a - b);
    expect(positions[1]! - positions[0]!).toBe(1);
  });

  it("every seat appears exactly once in the final order", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { order } = rollTurnOrder([0, 1, 2], mulberry32(seed));
      expect([...order].sort()).toEqual([0, 1, 2]);
    }
  });
});

describe("createInitialGame turn order", () => {
  it("keeps seat order and logs nothing without an rng", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
    expect(g.setup!.order).toEqual([0, 1, 2, 2, 1, 0]);
    expect(g.log).toEqual([]);
  });

  it("snakes the rolled order and starts with the roll winner", () => {
    const rng = mulberry32(11);
    const { order: rolled } = rollTurnOrder([0, 1, 2], mulberry32(11));
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }), rng);
    expect(g.setup!.order).toEqual([...rolled, ...[...rolled].reverse()]);
    expect(g.turn.activeSeat).toBe(rolled[0]);
  });

  it("logs orderRoll entries with 1-based round numbers", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }), mulberry32(11));
    const rolls = g.log.filter((e) => e.type === "orderRoll");
    expect(rolls.length).toBeGreaterThanOrEqual(3);
    expect(rolls[0]!.round).toBe(1);
    for (const e of rolls) {
      expect(e.dice).toHaveLength(2);
      expect(e.sum).toBe(e.dice![0]! + e.dice![1]!);
    }
  });
});

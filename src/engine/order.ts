import type { Rng } from "./rng";

export interface OrderRoll {
  seat: number;
  dice: [number, number];
  sum: number;
}

/**
 * Opening roll-off: every seat rolls 2d6 and the final order runs highest → lowest.
 * Ties re-roll only within the tied group (recursively), so a tie-break never moves
 * seats that weren't part of the tie. Every roll is recorded in `rounds` (index 0 is
 * the opening round; later rounds contain only the seats that were tied).
 */
export function rollTurnOrder(seats: number[], rng: Rng): { order: number[]; rounds: OrderRoll[][] } {
  const rounds: OrderRoll[][] = [];
  const order = resolve(seats, rng, rounds);
  return { order, rounds };
}

function resolve(seats: number[], rng: Rng, rounds: OrderRoll[][]): number[] {
  const d6 = () => 1 + rng.nextInt(6);
  const rolls: OrderRoll[] = seats.map((seat) => {
    const dice: [number, number] = [d6(), d6()];
    return { seat, dice, sum: dice[0] + dice[1] };
  });
  rounds.push(rolls);
  const bySum = new Map<number, number[]>();
  for (const r of rolls) bySum.set(r.sum, [...(bySum.get(r.sum) ?? []), r.seat]);
  const order: number[] = [];
  for (const sum of [...bySum.keys()].sort((a, b) => b - a)) {
    const group = bySum.get(sum)!;
    if (group.length === 1) order.push(group[0]!);
    else order.push(...resolve(group, rng, rounds)); // tie-break: permutes only this group
  }
  return order;
}

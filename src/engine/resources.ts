import type { Resource } from "../board/constants";

export type { Resource };
export type ResourceMap = Record<Resource, number>;

export const RESOURCE_LIST: readonly Resource[] = ["wood", "brick", "sheep", "wheat", "ore"];

export function emptyResources(): ResourceMap {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function fullBank(): ResourceMap {
  return { wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 };
}

export function totalCards(r: ResourceMap): number {
  return RESOURCE_LIST.reduce((sum, k) => sum + r[k], 0);
}

export function canAfford(have: ResourceMap, cost: ResourceMap): boolean {
  return RESOURCE_LIST.every((k) => have[k] >= cost[k]);
}

/** Subtract `cost` from `target` in place. */
export function payInto(target: ResourceMap, cost: ResourceMap): void {
  for (const k of RESOURCE_LIST) target[k] -= cost[k];
}

/** Add `gain` to `target` in place. */
export function gainInto(target: ResourceMap, gain: ResourceMap): void {
  for (const k of RESOURCE_LIST) target[k] += gain[k];
}

export const COSTS: Record<"road" | "settlement" | "city", ResourceMap> = {
  road: { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
  city: { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 },
};

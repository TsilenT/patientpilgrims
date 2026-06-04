export const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"] as const;
export type Resource = (typeof RESOURCES)[number];
export type TileKind = Resource | "desert";
export type PortKind = Resource | "any";

export const TILE_BAG: TileKind[] = [
  "wood", "wood", "wood", "wood",
  "sheep", "sheep", "sheep", "sheep",
  "wheat", "wheat", "wheat", "wheat",
  "brick", "brick", "brick",
  "ore", "ore", "ore",
  "desert",
];

export const NUMBER_BAG: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
];

/** Dots on the number token = ways to roll it = 6 - |7 - n|. */
export const PIP: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 0, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export const PORT_BAG: PortKind[] = [
  "any", "any", "any", "any",
  "wood", "brick", "sheep", "wheat", "ore",
];

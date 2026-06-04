import { buildTopology } from "./topology";
import { TILE_BAG, NUMBER_BAG, PIP, type TileKind } from "./constants";
import type { Rng } from "../engine/rng";

export interface Tile {
  kind: TileKind;
  number?: number; // undefined on desert
}

export interface TileAssignment {
  tiles: Record<string, Tile>; // hexId -> Tile
  robber: string;              // hexId holding the robber (starts on desert)
}

const topo = buildTopology();

function adjacentHexes(hid: string): string[] {
  const myEdges = topo.hexEdges.get(hid)!;
  return topo.hexIds.filter(
    (o) => o !== hid && topo.hexEdges.get(o)!.some((e) => myEdges.includes(e))
  );
}

function hasAdjacentReds(tiles: Record<string, Tile>): boolean {
  for (const hid of topo.hexIds) {
    const n = tiles[hid]!.number;
    if (n === undefined || PIP[n] !== 5) continue;
    for (const o of adjacentHexes(hid)) {
      const m = tiles[o]!.number;
      if (m !== undefined && PIP[m] === 5) return true;
    }
  }
  return false;
}

function assignOnce(rng: Rng): TileAssignment {
  const hexIds = topo.hexIds;
  const kinds = rng.shuffle([...TILE_BAG]);
  const numbers = rng.shuffle([...NUMBER_BAG]);

  const tiles: Record<string, Tile> = {};
  let robber = "";
  let numCursor = 0;
  hexIds.forEach((hid, i) => {
    const kind = kinds[i]!;
    if (kind === "desert") {
      tiles[hid] = { kind };
      robber = hid;
    } else {
      tiles[hid] = { kind, number: numbers[numCursor++]! };
    }
  });
  return { tiles, robber };
}

export function generateRandomBoard(rng: Rng): TileAssignment {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board = assignOnce(rng);
    if (!hasAdjacentReds(board.tiles)) return board;
  }
  // Extremely unlikely; return last attempt rather than loop forever.
  return assignOnce(rng);
}

// A fixed, deterministic reference layout (correct distributions).
// hexIds order is the deterministic output of boardHexes(2).
export function beginnerBoard(): TileAssignment {
  const hexIds = topo.hexIds;
  const layout: Tile[] = [
    { kind: "ore", number: 10 }, { kind: "sheep", number: 2 }, { kind: "wood", number: 9 },
    { kind: "wheat", number: 12 }, { kind: "brick", number: 6 }, { kind: "sheep", number: 4 },
    { kind: "brick", number: 10 }, { kind: "wheat", number: 9 }, { kind: "wood", number: 11 },
    { kind: "desert" }, { kind: "wood", number: 3 }, { kind: "ore", number: 8 },
    { kind: "sheep", number: 8 }, { kind: "ore", number: 3 }, { kind: "wheat", number: 4 },
    { kind: "sheep", number: 5 }, { kind: "brick", number: 5 }, { kind: "wheat", number: 6 },
    { kind: "wood", number: 11 },
  ];
  const tiles: Record<string, Tile> = {};
  let robber = "";
  hexIds.forEach((hid, i) => {
    const t = layout[i]!;
    tiles[hid] = t.number === undefined ? { kind: t.kind } : { kind: t.kind, number: t.number };
    if (t.kind === "desert") robber = hid;
  });
  return { tiles, robber };
}

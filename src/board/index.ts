import { buildTopology, type BoardTopology } from "./topology";
import { generateRandomBoard, beginnerBoard, type Tile } from "./generate";
import { placePorts, type Port } from "./ports";
import type { Rng } from "../engine/rng";

export type { BoardTopology } from "./topology";
export type { Tile, TileAssignment } from "./generate";
export type { Port } from "./ports";
export * from "./coords";
export * from "./constants";

export interface Board {
  topology: BoardTopology;
  tiles: Record<string, Tile>;
  robber: string;
  ports: Port[];
}

export type CreateBoardOptions =
  | { mode: "random"; rng: Rng }
  | { mode: "beginner" };

export function createBoard(opts: CreateBoardOptions): Board {
  const assignment = opts.mode === "random" ? generateRandomBoard(opts.rng) : beginnerBoard();
  return {
    topology: buildTopology(),
    tiles: assignment.tiles,
    robber: assignment.robber,
    ports: placePorts(),
  };
}

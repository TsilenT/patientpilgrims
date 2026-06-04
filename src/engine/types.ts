import type { Tile, Port } from "../board";
import type { Resource } from "../board/constants";
import type { ResourceMap } from "./resources";
import type { DevCardType } from "./devcards";

export type { Tile, Port, Resource, ResourceMap };

export type Phase = "setup" | "main" | "finished";
export type SubPhase =
  | "setupSettlement" | "setupRoad" | "awaitingRoll" | "main"
  | "movingRobber";

export interface Building {
  owner: number;
  type: "settlement" | "city";
}

export interface RoadPiece {
  owner: number;
}

export interface BoardState {
  tiles: Record<string, Tile>;
  robber: string;
  ports: Port[];
  buildings: Record<string, Building>;
  roads: Record<string, RoadPiece>;
}

export interface PlayerDevCard {
  type: DevCardType;
  boughtThisTurn: boolean;
  played: boolean;
}

export interface Player {
  seat: number;
  name: string;
  color: string;
  resources: ResourceMap;
  victoryPoints: number;
  pieces: { roads: number; settlements: number; cities: number };
  devCards: PlayerDevCard[];
}

export interface Turn {
  activeSeat: number;
  subPhase: SubPhase;
  dice?: [number, number];
  setupSettlement?: string;
}

export interface LogEntry {
  type:
    | "setupSettlement" | "setupRoad"
    | "roll" | "buildRoad" | "buildSettlement" | "buildCity"
    | "endTurn" | "win" | "discard"
    | "moveRobber" | "steal";
  seat: number;
  vertex?: string;
  edge?: string;
  dice?: [number, number];
  sum?: number;
  count?: number;
  hex?: string;
  victim?: number;
  resource?: Resource;
}

export interface GameState {
  version: number;
  phase: Phase;
  turn: Turn;
  board: BoardState;
  players: Player[];
  bank: ResourceMap;
  devDeck: DevCardType[];
  setup?: { order: number[]; pos: number };
  discardObligations?: Record<number, number>; // seat -> cards still owed after a 7
  log: LogEntry[];
  winner?: number;
}

export type Action =
  | { type: "setupSettlement"; vertex: string }
  | { type: "setupRoad"; edge: string }
  | { type: "rollDice" }
  | { type: "buildRoad"; edge: string }
  | { type: "buildSettlement"; vertex: string }
  | { type: "buildCity"; vertex: string }
  | { type: "endTurn" }
  | { type: "discard"; seat: number; cards: ResourceMap }
  | { type: "moveRobber"; hex: string; victim?: number };

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

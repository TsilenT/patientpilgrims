import type { Board } from "../board";
import type { GameState, Player, BoardState } from "./types";
import { emptyResources, fullBank } from "./resources";
import { makeDevDeck } from "./devcards";

export interface NewPlayer {
  name: string;
  color: string;
}

/** Snake draft order: seats forward, then the same seats in reverse. */
export function snakeOrder(playerCount: number): number[] {
  const forward = Array.from({ length: playerCount }, (_, i) => i);
  return [...forward, ...[...forward].reverse()];
}

export function createInitialGame(players: NewPlayer[], board: Board): GameState {
  if (players.length < 3 || players.length > 4) {
    throw new Error("Catan base game supports 3-4 players");
  }
  const boardState: BoardState = {
    tiles: structuredClone(board.tiles),
    robber: board.robber,
    ports: structuredClone(board.ports),
    buildings: {},
    roads: {},
  };
  const playerStates: Player[] = players.map((p, seat) => ({
    seat,
    name: p.name,
    color: p.color,
    resources: emptyResources(),
    victoryPoints: 0,
    pieces: { roads: 15, settlements: 5, cities: 4 },
    devCards: [],
  }));
  const order = snakeOrder(players.length);
  return {
    version: 0,
    phase: "setup",
    turn: { activeSeat: order[0]!, subPhase: "setupSettlement" },
    board: boardState,
    players: playerStates,
    bank: fullBank(),
    devDeck: makeDevDeck(),
    setup: { order, pos: 0 },
    log: [],
  };
}

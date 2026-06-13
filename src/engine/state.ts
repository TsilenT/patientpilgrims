import type { Board } from "../board";
import type { GameState, Player, BoardState, LogEntry } from "./types";
import type { Rng } from "./rng";
import { emptyResources, fullBank } from "./resources";
import { makeDevDeck } from "./devcards";
import { rollTurnOrder } from "./order";

export interface NewPlayer {
  name: string;
  color: string;
}

/** Snake draft order: seats forward, then the same seats in reverse. */
export function snakeOrder(playerCount: number): number[] {
  const forward = Array.from({ length: playerCount }, (_, i) => i);
  return [...forward, ...[...forward].reverse()];
}

export function createInitialGame(players: NewPlayer[], board: Board, rng?: Rng): GameState {
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
    knightsPlayed: 0,
    longestRoadLength: 0,
  }));
  // With an rng, an opening roll-off decides who goes first (highest → lowest,
  // ties re-rolled within the tied group); without one, seats play in index order.
  let seatOrder = playerStates.map((p) => p.seat);
  const log: LogEntry[] = [];
  if (rng) {
    const { order: rolled, rounds } = rollTurnOrder(seatOrder, rng);
    seatOrder = rolled;
    rounds.forEach((round, i) => {
      for (const r of round) log.push({ type: "orderRoll", seat: r.seat, dice: r.dice, sum: r.sum, round: i + 1 });
    });
  }
  const order = [...seatOrder, ...[...seatOrder].reverse()];
  return {
    version: 0,
    phase: "setup",
    turn: { activeSeat: order[0]!, subPhase: "setupSettlement" },
    board: boardState,
    players: playerStates,
    bank: fullBank(),
    devDeck: makeDevDeck(),
    awards: {},
    tradeOffers: [],
    tradeSeq: 0,
    turnOrder: seatOrder,
    setup: { order, pos: 0 },
    log,
  };
}

import type { GameState } from "../engine/types";
import { RESOURCE_LIST, totalCards } from "../engine/resources";
import { topology } from "../engine/board";
import { displayVictoryPoints } from "../engine/scoring/victory";

/** Opponents with a building on `hex` who hold at least one card — the legal steal targets. */
export function eligibleVictims(state: GameState, hex: string): number[] {
  const active = state.turn.activeSeat;
  const owners = new Set<number>();
  for (const v of topology().hexVertices.get(hex) ?? []) {
    const b = state.board.buildings[v];
    if (b && b.owner !== active) owners.add(b.owner);
  }
  return [...owners].filter((s) => totalCards(state.players[s]!.resources) > 0);
}

export function currentActor(state: GameState): number {
  const owing = state.discardObligations;
  if (owing) {
    const seats = Object.keys(owing).map(Number).filter((s) => (owing[s] ?? 0) > 0);
    if (seats.length) return Math.min(...seats);
  }
  return state.turn.activeSeat;
}

export interface OpponentView {
  seat: number; name: string; color: string;
  resourceCount: number; devCardCount: number;
  victoryPoints: number; knightsPlayed: number; longestRoadLength: number;
  hasLargestArmy: boolean; hasLongestRoad: boolean;
}

export function opponentView(state: GameState, seat: number): OpponentView {
  const p = state.players[seat]!;
  return {
    seat, name: p.name, color: p.color,
    resourceCount: RESOURCE_LIST.reduce((s, r) => s + p.resources[r], 0),
    devCardCount: p.devCards.filter((c) => !c.played).length,
    victoryPoints: displayVictoryPoints(state, seat), knightsPlayed: p.knightsPlayed,
    longestRoadLength: p.longestRoadLength,
    hasLargestArmy: state.awards.largestArmy === seat,
    hasLongestRoad: state.awards.longestRoad === seat,
  };
}

export function opponentsOf(state: GameState, viewingSeat: number): OpponentView[] {
  return state.players.filter((p) => p.seat !== viewingSeat).map((p) => opponentView(state, p.seat));
}

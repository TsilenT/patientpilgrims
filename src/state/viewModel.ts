import type { GameState } from "../engine/types";
import { RESOURCE_LIST } from "../engine/resources";

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
    devCardCount: p.devCards.length,
    victoryPoints: p.victoryPoints, knightsPlayed: p.knightsPlayed,
    longestRoadLength: p.longestRoadLength,
    hasLargestArmy: state.awards.largestArmy === seat,
    hasLongestRoad: state.awards.longestRoad === seat,
  };
}

export function opponentsOf(state: GameState, viewingSeat: number): OpponentView[] {
  return state.players.filter((p) => p.seat !== viewingSeat).map((p) => opponentView(state, p.seat));
}

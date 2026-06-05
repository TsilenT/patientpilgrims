import type { GameState } from "../types";
import { playKnightGuard } from "./dev";
import { recomputeVictoryPoints } from "../scoring/victory";

/** Update Largest Army after a knight is played; recomputes VP for affected seats. */
function updateLargestArmy(state: GameState, seat: number): void {
  const me = state.players[seat]!.knightsPlayed;
  if (me < 3) return;
  const holder = state.awards.largestArmy;
  const holderCount = holder === undefined ? 0 : state.players[holder]!.knightsPlayed;
  if (holder === seat) return;
  if (me > holderCount) {
    state.awards.largestArmy = seat;
    if (holder !== undefined) recomputeVictoryPoints(state, holder);
    recomputeVictoryPoints(state, seat);
  }
}

export function applyPlayKnight(state: GameState): string | null {
  const err = playKnightGuard(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  state.players[seat]!.knightsPlayed += 1;
  updateLargestArmy(state, seat);
  state.log.push({ type: "playKnight", seat });
  state.turn.robberReturn = state.turn.subPhase; // "main" or "awaitingRoll"
  state.turn.subPhase = "movingRobber";
  return null;
}

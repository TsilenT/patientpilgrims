import type { GameState } from "../types";

/** Settlements are worth 1 VP, cities 2. */
export function victoryPointsFromBuildings(state: GameState, seat: number): number {
  let vp = 0;
  for (const b of Object.values(state.board.buildings)) {
    if (b.owner === seat) vp += b.type === "city" ? 2 : 1;
  }
  return vp;
}

export function recomputeVictoryPoints(state: GameState, seat: number): void {
  const player = state.players[seat]!;
  let vp = victoryPointsFromBuildings(state, seat);
  if (state.awards.largestArmy === seat) vp += 2;
  if (state.awards.longestRoad === seat) vp += 2;
  player.victoryPoints = vp;
}

/** Public VP plus hidden victory-point development cards. */
export function totalVictoryPoints(state: GameState, seat: number): number {
  const player = state.players[seat]!;
  const hiddenVp = player.devCards.filter((c) => c.type === "victoryPoint").length;
  return player.victoryPoints + hiddenVp;
}

/** Show only public VP during play; reveal hidden VP after the game finishes. */
export function displayVictoryPoints(state: GameState, seat: number): number {
  return state.phase === "finished" ? totalVictoryPoints(state, seat) : state.players[seat]!.victoryPoints;
}

/** Ends the game for the first player at 10+ VP. */
export function checkVictory(state: GameState): void {
  for (const p of state.players) {
    if (totalVictoryPoints(state, p.seat) >= 10) {
      state.phase = "finished";
      state.winner = p.seat;
      state.log.push({ type: "win", seat: p.seat });
      return;
    }
  }
}

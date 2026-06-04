import type { GameState } from "../types";

/** Settlements are worth 1 VP, cities 2 (Phase 1b: VP only from buildings). */
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
  for (const c of player.devCards) {
    if (c.type === "victoryPoint") vp += 1;
  }
  player.victoryPoints = vp;
}

/** Ends the game for the first player at 10+ VP. */
export function checkVictory(state: GameState): void {
  for (const p of state.players) {
    if (p.victoryPoints >= 10) {
      state.phase = "finished";
      state.winner = p.seat;
      state.log.push({ type: "win", seat: p.seat });
      return;
    }
  }
}

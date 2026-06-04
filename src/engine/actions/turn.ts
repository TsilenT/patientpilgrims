import type { GameState } from "../types";

export function applyEndTurn(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll before ending your turn";
  const prev = state.turn.activeSeat;
  const next = (prev + 1) % state.players.length;
  for (const c of state.players[prev]!.devCards) c.boughtThisTurn = false;
  state.turn = { activeSeat: next, subPhase: "awaitingRoll" };
  state.log.push({ type: "endTurn", seat: prev });
  return null;
}

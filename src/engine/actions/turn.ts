import type { GameState } from "../types";

export function applyEndTurn(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll before ending your turn";
  const prev = state.turn.activeSeat;
  const order = state.turnOrder?.length > 0 ? state.turnOrder : state.players.map((p) => p.seat);
  const prevIndex = order.indexOf(prev);
  const next = order[(prevIndex + 1) % order.length] ?? order[0]!;
  for (const c of state.players[prev]!.devCards) c.boughtThisTurn = false;
  state.tradeOffers = state.tradeOffers.filter((offer) => offer.from !== next);
  state.turn = { activeSeat: next, subPhase: "awaitingRoll" };
  state.log.push({ type: "endTurn", seat: prev });
  return null;
}

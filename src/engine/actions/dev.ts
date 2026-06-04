import type { GameState } from "../types";
import type { Rng } from "../rng";
import type { DevCardType } from "../devcards";
import { canAfford, payInto, RESOURCE_LIST } from "../resources";
import { DEV_CARD_COST } from "../devcards";
import { recomputeVictoryPoints } from "../scoring/victory";

function requireMain(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  return null;
}

export function applyBuyDevCard(state: GameState, rng: Rng): string | null {
  const err = requireMain(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  if (state.devDeck.length === 0) return "The development deck is empty";
  if (!canAfford(player.resources, DEV_CARD_COST)) return "Not enough resources for a development card";

  payInto(player.resources, DEV_CARD_COST);
  for (const k of RESOURCE_LIST) state.bank[k] += DEV_CARD_COST[k];

  const i = rng.nextInt(state.devDeck.length);
  const card = state.devDeck.splice(i, 1)[0]!;
  player.devCards.push({ type: card, boughtThisTurn: true, played: false });

  if (card === "victoryPoint") recomputeVictoryPoints(state, seat);
  state.log.push({ type: "buyDevCard", seat });
  return null;
}

export function playDevCardGuard(state: GameState, type: DevCardType): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  if (state.turn.devCardPlayedThisTurn) return "You already played a development card this turn";
  const player = state.players[state.turn.activeSeat]!;
  const card = player.devCards.find((c) => c.type === type && !c.played && !c.boughtThisTurn);
  if (!card) return `You have no playable ${type} card`;
  card.played = true;
  state.turn.devCardPlayedThisTurn = true;
  return null;
}

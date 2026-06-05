import type { GameState, Resource, TradeOffer } from "../types";
import type { ResourceMap } from "../resources";
import { RESOURCE_LIST, canAfford, totalCards } from "../resources";

export function portRatio(state: GameState, seat: number, resource: Resource): number {
  let ratio = 4;
  for (const port of state.board.ports) {
    const owns = port.vertices.some((v) => state.board.buildings[v]?.owner === seat);
    if (!owns) continue;
    if (port.kind === "any") ratio = Math.min(ratio, 3);
    else if (port.kind === resource) ratio = Math.min(ratio, 2);
  }
  return ratio;
}

function requireMain(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  return null;
}

export function applyProposeTrade(state: GameState, give: ResourceMap, want: ResourceMap, to: number | undefined): string | null {
  const err = requireMain(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  const nonNeg = (m: ResourceMap) => RESOURCE_LIST.every((r) => m[r] >= 0);
  if (!nonNeg(give) || !nonNeg(want)) return "Trade amounts cannot be negative";
  if (totalCards(give) === 0 || totalCards(want) === 0) return "A trade must offer and request something";
  if (!canAfford(state.players[seat]!.resources, give)) return "You do not have what you are offering";
  const offer: TradeOffer = to !== undefined
    ? { id: state.tradeSeq, from: seat, to, give, want }
    : { id: state.tradeSeq, from: seat, give, want };
  state.tradeSeq += 1;
  state.tradeOffers.push(offer);
  state.log.push({ type: "proposeTrade", seat });
  return null;
}

export function applyTradeBank(state: GameState, give: Resource, get: Resource): string | null {
  const err = requireMain(state);
  if (err) return err;
  if (give === get) return "Trade two different resources";
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  const ratio = portRatio(state, seat, give);
  if (player.resources[give] < ratio) return `You need ${ratio} ${give} to trade`;
  if (state.bank[get] < 1) return "The bank is out of that resource";
  player.resources[give] -= ratio;
  state.bank[give] += ratio;
  player.resources[get] += 1;
  state.bank[get] -= 1;
  state.log.push({ type: "tradeBank", seat });
  return null;
}

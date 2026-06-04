import type { GameState } from "../types";
import { RESOURCE_LIST, type ResourceMap } from "../resources";

export function applyDiscard(state: GameState, seat: number, cards: ResourceMap): string | null {
  const owed = state.discardObligations?.[seat] ?? 0;
  if (owed <= 0) return "You do not owe a discard";
  const player = state.players[seat];
  if (!player) return "Unknown player";

  let sum = 0;
  for (const res of RESOURCE_LIST) {
    const n = cards[res];
    if (n < 0) return "Discard amounts cannot be negative";
    if (n > player.resources[res]) return "Cannot discard cards you do not have";
    sum += n;
  }
  if (sum !== owed) return `You must discard exactly ${owed} card(s)`;

  for (const res of RESOURCE_LIST) {
    player.resources[res] -= cards[res];
    state.bank[res] += cards[res];
  }
  state.log.push({ type: "discard", seat, count: owed });

  delete state.discardObligations![seat];
  if (Object.keys(state.discardObligations!).length === 0) {
    delete state.discardObligations;
  }
  return null;
}

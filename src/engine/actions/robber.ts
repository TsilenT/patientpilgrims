import type { GameState, Resource } from "../types";
import type { Rng } from "../rng";
import { topology } from "../board";
import { RESOURCE_LIST, totalCards, type ResourceMap } from "../resources";

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

function stealRandom(state: GameState, fromSeat: number, toSeat: number, rng: Rng): Resource | null {
  const victim = state.players[fromSeat]!;
  const pool: Resource[] = [];
  for (const res of RESOURCE_LIST) {
    for (let i = 0; i < victim.resources[res]; i++) pool.push(res);
  }
  if (pool.length === 0) return null;
  const res = pool[rng.nextInt(pool.length)]!;
  victim.resources[res] -= 1;
  state.players[toSeat]!.resources[res] += 1;
  return res;
}

export function applyMoveRobber(
  state: GameState,
  hex: string,
  victim: number | undefined,
  rng: Rng,
): string | null {
  if (state.turn.subPhase !== "movingRobber") return "Not time to move the robber";
  if (!topology().hexIds.includes(hex)) return "Unknown hex";
  if (hex === state.board.robber) return "The robber must move to a different hex";

  const active = state.turn.activeSeat;
  const owners = new Set<number>();
  for (const v of topology().hexVertices.get(hex) ?? []) {
    const b = state.board.buildings[v];
    if (b && b.owner !== active) owners.add(b.owner);
  }
  const eligible = [...owners].filter((s) => totalCards(state.players[s]!.resources) > 0);

  if (victim !== undefined) {
    if (!eligible.includes(victim)) {
      return "You can only steal from a player with a building on that hex who holds cards";
    }
  } else if (eligible.length > 0) {
    return "You must choose a player to steal from";
  }

  state.board.robber = hex;
  state.log.push({ type: "moveRobber", seat: active, hex });
  if (victim !== undefined) {
    const res = stealRandom(state, victim, active, rng);
    if (res !== null) state.log.push({ type: "steal", seat: active, victim, resource: res });
  }
  state.turn.subPhase = state.turn.robberReturn ?? "main";
  delete state.turn.robberReturn;
  return null;
}

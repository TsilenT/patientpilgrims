import type { GameState, Resource } from "../types";
import type { Rng } from "../rng";
import type { DevCardType } from "../devcards";
import { canAfford, payInto, RESOURCE_LIST, emptyResources } from "../resources";
import { DEV_CARD_COST } from "../devcards";
import { recomputeVictoryPoints } from "../scoring/victory";
import { topology } from "../board";
import { edgeConnects } from "../placement";

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

export function applyPlayMonopoly(state: GameState, resource: Resource): string | null {
  const err = playDevCardGuard(state, "monopoly");
  if (err) return err;
  const seat = state.turn.activeSeat;
  let taken = 0;
  for (const p of state.players) {
    if (p.seat === seat) continue;
    taken += p.resources[resource];
    state.players[seat]!.resources[resource] += p.resources[resource];
    p.resources[resource] = 0;
  }
  state.log.push({ type: "playMonopoly", seat, resource, count: taken });
  return null;
}

export function applyPlayYearOfPlenty(state: GameState, picks: [Resource, Resource]): string | null {
  const err = playDevCardGuard(state, "yearOfPlenty");
  if (err) return err;
  const need = emptyResources();
  for (const r of picks) need[r] += 1;
  for (const r of RESOURCE_LIST) if (state.bank[r] < need[r]) return "The bank cannot supply those resources";
  const seat = state.turn.activeSeat;
  for (const r of picks) { state.bank[r] -= 1; state.players[seat]!.resources[r] += 1; }
  state.log.push({ type: "playYearOfPlenty", seat });
  return null;
}

export function applyPlayRoadBuilding(state: GameState, edges: string[]): string | null {
  if (edges.length < 1 || edges.length > 2) return "Road building places one or two roads";
  if (new Set(edges).size !== edges.length) return "Cannot place two roads on the same edge";
  const err = playDevCardGuard(state, "roadBuilding");
  if (err) return err;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  for (const edge of edges) {
    if (!topology().edgeIds.includes(edge)) return "Unknown edge";
    if (state.board.roads[edge] !== undefined) return "Edge already has a road";
    if (player.pieces.roads <= 0) return "No roads left in stock";
    if (!edgeConnects(state.board, seat, edge)) return "Road must connect to your network";
    state.board.roads[edge] = { owner: seat };
    player.pieces.roads -= 1;
    state.log.push({ type: "playRoadBuilding", seat, edge });
  }
  return null;
}

export function playDevCardGuard(state: GameState, type: DevCardType): string | null {
  const err = requireMain(state);
  if (err) return err;
  if (state.turn.devCardPlayedThisTurn) return "You already played a development card this turn";
  const player = state.players[state.turn.activeSeat]!;
  const card = player.devCards.find((c) => c.type === type && !c.played && !c.boughtThisTurn);
  if (!card) return `You have no playable ${type} card`;
  card.played = true;
  state.turn.devCardPlayedThisTurn = true;
  return null;
}

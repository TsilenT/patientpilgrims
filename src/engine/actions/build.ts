import type { GameState } from "../types";
import { topology } from "../board";
import { COSTS, canAfford, payInto, RESOURCE_LIST, type ResourceMap } from "../resources";
import { respectsDistance, vertexOnNetwork, edgeConnects } from "../placement";
import { recomputeVictoryPoints } from "../scoring/victory";

function requireMain(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  return null;
}

function payToBank(state: GameState, seat: number, cost: ResourceMap): void {
  payInto(state.players[seat]!.resources, cost);
  for (const k of RESOURCE_LIST) state.bank[k] += cost[k];
}

export function applyBuildRoad(state: GameState, edge: string): string | null {
  const phaseErr = requireMain(state);
  if (phaseErr) return phaseErr;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  if (!topology().edgeIds.includes(edge)) return "Unknown edge";
  if (state.board.roads[edge] !== undefined) return "Edge already has a road";
  if (player.pieces.roads <= 0) return "No roads left in stock";
  if (!canAfford(player.resources, COSTS.road)) return "Not enough resources for a road";
  if (!edgeConnects(state.board, seat, edge)) return "Road must connect to your network";

  payToBank(state, seat, COSTS.road);
  state.board.roads[edge] = { owner: seat };
  player.pieces.roads -= 1;
  state.log.push({ type: "buildRoad", seat, edge });
  return null;
}

export function applyBuildSettlement(state: GameState, vertex: string): string | null {
  const phaseErr = requireMain(state);
  if (phaseErr) return phaseErr;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  if (!topology().vertexIds.includes(vertex)) return "Unknown vertex";
  if (!respectsDistance(state.board, vertex)) return "Vertex is occupied or too close to another settlement";
  if (player.pieces.settlements <= 0) return "No settlements left in stock";
  if (!canAfford(player.resources, COSTS.settlement)) return "Not enough resources for a settlement";
  if (!vertexOnNetwork(state.board, seat, vertex)) return "Settlement must sit on your road network";

  payToBank(state, seat, COSTS.settlement);
  state.board.buildings[vertex] = { owner: seat, type: "settlement" };
  player.pieces.settlements -= 1;
  recomputeVictoryPoints(state, seat);
  state.log.push({ type: "buildSettlement", seat, vertex });
  return null;
}

export function applyBuildCity(state: GameState, vertex: string): string | null {
  const phaseErr = requireMain(state);
  if (phaseErr) return phaseErr;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  const b = state.board.buildings[vertex];
  if (!b || b.owner !== seat || b.type !== "settlement") return "You must upgrade your own settlement";
  if (player.pieces.cities <= 0) return "No cities left in stock";
  if (!canAfford(player.resources, COSTS.city)) return "Not enough resources for a city";

  payToBank(state, seat, COSTS.city);
  state.board.buildings[vertex] = { owner: seat, type: "city" };
  player.pieces.cities -= 1;
  player.pieces.settlements += 1; // the settlement piece returns to stock
  recomputeVictoryPoints(state, seat);
  state.log.push({ type: "buildCity", seat, vertex });
  return null;
}

import type { GameState } from "../types";
import { topology } from "../board";
import { respectsDistance, legalSetupRoads } from "../placement";
import { gainInto, emptyResources } from "../resources";
import { recomputeVictoryPoints } from "../scoring/victory";

export function applySetupSettlement(state: GameState, vertex: string): string | null {
  if (state.turn.subPhase !== "setupSettlement") return "Not awaiting a setup settlement";
  if (!topology().vertexIds.includes(vertex)) return "Unknown vertex";
  if (!respectsDistance(state.board, vertex)) return "Vertex violates the distance rule";

  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  state.board.buildings[vertex] = { owner: seat, type: "settlement" };
  player.pieces.settlements -= 1;
  recomputeVictoryPoints(state, seat);

  // The second settlement (placed in the reverse half of the snake) grants resources.
  const isSecond = state.setup!.pos >= state.players.length;
  if (isSecond) {
    for (const hid of topology().vertexHexes.get(vertex) ?? []) {
      const tile = state.board.tiles[hid]!;
      if (tile.kind === "desert") continue;
      const gain = emptyResources();
      gain[tile.kind] = 1;
      if (state.bank[tile.kind] > 0) {
        gainInto(player.resources, gain);
        state.bank[tile.kind] -= 1;
      }
    }
  }

  state.turn.subPhase = "setupRoad";
  state.turn.setupSettlement = vertex;
  state.log.push({ type: "setupSettlement", seat, vertex });
  return null;
}

export function applySetupRoad(state: GameState, edge: string): string | null {
  if (state.turn.subPhase !== "setupRoad") return "Not awaiting a setup road";
  const settlement = state.turn.setupSettlement;
  if (settlement === undefined) return "No settlement to attach the road to";
  if (!topology().edgeIds.includes(edge)) return "Unknown edge";
  if (state.board.roads[edge] !== undefined) return "Edge already has a road";
  if (!legalSetupRoads(state.board, settlement).includes(edge)) {
    return "Road must connect to the settlement just placed";
  }

  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  state.board.roads[edge] = { owner: seat };
  player.pieces.roads -= 1;
  state.log.push({ type: "setupRoad", seat, edge });

  const setup = state.setup!;
  setup.pos += 1;
  delete state.turn.setupSettlement;
  if (setup.pos >= setup.order.length) {
    delete state.setup;
    state.phase = "main";
    state.turn = { activeSeat: 0, subPhase: "awaitingRoll" };
  } else {
    state.turn.activeSeat = setup.order[setup.pos]!;
    state.turn.subPhase = "setupSettlement";
  }
  return null;
}

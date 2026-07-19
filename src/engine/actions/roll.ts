import type { GameState, LogEntry, Resource } from "../types";
import type { Rng } from "../rng";
import { topology } from "../board";
import {
  RESOURCE_LIST, emptyResources, totalCards, DISCARD_LIMIT, type ResourceMap,
} from "../resources";

export function applyRollDice(state: GameState, rng: Rng): string | null {
  if (state.turn.subPhase !== "awaitingRoll") return "Not awaiting a dice roll";
  const d1 = rng.nextInt(6) + 1;
  const d2 = rng.nextInt(6) + 1;
  const sum = d1 + d2;
  state.turn.dice = [d1, d2];
  const entry: LogEntry = { type: "roll", seat: state.turn.activeSeat, dice: [d1, d2], sum };
  state.log.push(entry);

  if (sum === 7) {
    const owed: Record<number, number> = { ...(state.discardObligations ?? {}) };
    for (const p of state.players) {
      const priorOwed = owed[p.seat] ?? 0;
      const virtualTotal = Math.max(0, totalCards(p.resources) - priorOwed);
      if (virtualTotal > DISCARD_LIMIT) owed[p.seat] = priorOwed + Math.floor(virtualTotal / 2);
    }
    if (Object.keys(owed).length > 0) state.discardObligations = owed;
    state.turn.robberReturn = "main";
    state.turn.subPhase = "movingRobber"; // roller proceeds; discards don't block
    return null;
  }

  state.turn.subPhase = "main";
  const blocked = robberBlockedProduction(state, sum);
  if (Object.keys(blocked).length > 0) entry.blocked = blocked;
  const gains = produce(state, sum);
  // Presence (including an empty object) distinguishes complete modern logs from
  // legacy roll entries that predate production-history recording.
  entry.gains = gains;
  return null;
}

/** Counts cards buildings would have produced from the robber's tile. */
function robberBlockedProduction(state: GameState, sum: number): Record<number, number> {
  const tile = state.board.tiles[state.board.robber];
  if (!tile || tile.kind === "desert" || tile.number !== sum) return {};
  const blocked: Record<number, number> = {};
  for (const vertex of topology().hexVertices.get(state.board.robber) ?? []) {
    const building = state.board.buildings[vertex];
    if (!building) continue;
    blocked[building.owner] = (blocked[building.owner] ?? 0) + (building.type === "city" ? 2 : 1);
  }
  return blocked;
}

/** Distributes production for `sum` and returns the resources actually gained, by seat. */
function produce(state: GameState, sum: number): Record<number, Partial<ResourceMap>> {
  const owed: ResourceMap[] = state.players.map(() => emptyResources());
  for (const hid of topology().hexIds) {
    const tile = state.board.tiles[hid]!;
    if (tile.number !== sum) continue;
    if (hid === state.board.robber) continue;
    if (tile.kind === "desert") continue;
    const res: Resource = tile.kind;
    for (const v of topology().hexVertices.get(hid) ?? []) {
      const b = state.board.buildings[v];
      if (!b) continue;
      owed[b.owner]![res] += b.type === "city" ? 2 : 1;
    }
  }

  const gains: Record<number, Partial<ResourceMap>> = {};
  const grant = (seat: number, res: Resource, amt: number): void => {
    if (amt <= 0) return;
    state.players[seat]!.resources[res] += amt;
    state.bank[res] -= amt;
    (gains[seat] ??= {})[res] = (gains[seat]![res] ?? 0) + amt;
  };

  for (const res of RESOURCE_LIST) {
    const demand = owed.reduce((s, o) => s + o[res], 0);
    if (demand === 0) continue;
    if (state.bank[res] >= demand) {
      for (let seat = 0; seat < owed.length; seat++) grant(seat, res, owed[seat]![res]);
    } else {
      // Bank rule: if the bank can't cover everyone, only a sole claimant draws (partial).
      const claimants = owed.filter((o) => o[res] > 0).length;
      if (claimants === 1) {
        const seat = owed.findIndex((o) => o[res] > 0);
        grant(seat, res, Math.min(owed[seat]![res], state.bank[res]));
      }
    }
  }
  return gains;
}

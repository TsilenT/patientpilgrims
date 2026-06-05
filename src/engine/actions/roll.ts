import type { GameState, Resource } from "../types";
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
  state.log.push({ type: "roll", seat: state.turn.activeSeat, dice: [d1, d2], sum });

  if (sum === 7) {
    const owed: Record<number, number> = {};
    for (const p of state.players) {
      const total = totalCards(p.resources);
      if (total > DISCARD_LIMIT) owed[p.seat] = Math.floor(total / 2);
    }
    if (Object.keys(owed).length > 0) state.discardObligations = owed;
    state.turn.robberReturn = "main";
    state.turn.subPhase = "movingRobber"; // roller proceeds; discards don't block
    return null;
  }

  state.turn.subPhase = "main";
  produce(state, sum);
  return null;
}

function produce(state: GameState, sum: number): void {
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

  for (const res of RESOURCE_LIST) {
    const demand = owed.reduce((s, o) => s + o[res], 0);
    if (demand === 0) continue;
    if (state.bank[res] >= demand) {
      for (let seat = 0; seat < owed.length; seat++) {
        const amt = owed[seat]![res];
        if (amt === 0) continue;
        state.players[seat]!.resources[res] += amt;
        state.bank[res] -= amt;
      }
    } else {
      const claimants = owed.filter((o) => o[res] > 0).length;
      if (claimants === 1) {
        const seat = owed.findIndex((o) => o[res] > 0);
        const give = Math.min(owed[seat]![res], state.bank[res]);
        state.players[seat]!.resources[res] += give;
        state.bank[res] -= give;
      }
    }
  }
}

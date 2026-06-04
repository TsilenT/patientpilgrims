import type { GameState, Resource } from "../types";
import type { Rng } from "../rng";
import { topology } from "../board";
import { RESOURCE_LIST, emptyResources, type ResourceMap } from "../resources";

export function applyRollDice(state: GameState, rng: Rng): string | null {
  if (state.turn.subPhase !== "awaitingRoll") return "Not awaiting a dice roll";
  const d1 = rng.nextInt(6) + 1;
  const d2 = rng.nextInt(6) + 1;
  const sum = d1 + d2;
  state.turn.dice = [d1, d2];
  state.turn.subPhase = "main";
  state.log.push({ type: "roll", seat: state.turn.activeSeat, dice: [d1, d2], sum });

  // 7: robber/discard deferred to Phase 1c — produce nothing, turn continues.
  if (sum !== 7) produce(state, sum);
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
      // multiple claimants + insufficient bank: nobody gets this resource
    }
  }
}

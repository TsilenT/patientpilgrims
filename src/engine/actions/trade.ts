import type { GameState, Resource } from "../types";

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

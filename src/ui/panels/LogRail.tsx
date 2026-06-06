import { useGame } from "../../state/GameProvider";
import type { GameState, LogEntry } from "../../engine/types";

function describe(state: GameState, e: LogEntry): string {
  const name = state.players[e.seat]?.name ?? `Seat ${e.seat}`;
  switch (e.type) {
    case "roll": return `${name} rolled ${e.sum}`;
    case "buildRoad": return `${name} built a road`;
    case "buildSettlement": return `${name} built a settlement`;
    case "buildCity": return `${name} built a city`;
    case "setupSettlement": return `${name} placed a settlement`;
    case "setupRoad": return `${name} placed a road`;
    case "endTurn": return `${name} ended their turn`;
    case "win": return `${name} won the game!`;
    case "discard": return `${name} discarded ${e.count ?? 0}`;
    case "moveRobber": return `${name} moved the robber`;
    case "steal": return `${name} stole a card`;
    case "buyDevCard": return `${name} bought a development card`;
    case "playMonopoly": return `${name} played Monopoly`;
    case "playYearOfPlenty": return `${name} played Year of Plenty`;
    case "playRoadBuilding": return `${name} played Road Building`;
    case "playKnight": return `${name} played a Knight`;
    case "tradeBank": return `${name} traded with the bank`;
    case "proposeTrade": return `${name} proposed a trade`;
    case "acceptTrade": return `${name} accepted a trade`;
    case "cancelTrade": return `${name} cancelled a trade`;
    default: return `${name}: ${e.type}`;
  }
}

export function LogRail() {
  const { state } = useGame();
  const start = Math.max(0, state.log.length - 15);
  const entries = state.log.slice(start);
  return (
    <ul className="log-rail" aria-label="Game log">
      {entries.map((e, i) => (
        <li key={start + i} data-log-type={e.type}>{describe(state, e)}</li>
      ))}
    </ul>
  );
}

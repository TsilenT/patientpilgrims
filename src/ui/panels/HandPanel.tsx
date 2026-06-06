import { useGame } from "../../state/GameProvider";
import { currentActor } from "../../state/viewModel";
import { RESOURCE_LIST } from "../../engine/resources";
import type { PlayerDevCard } from "../../engine/types";
import type { DevCardType } from "../../engine/devcards";
import { CostReference } from "./CostReference";

export function HandPanel({ onPlayDev }: { onPlayDev?: (type: DevCardType) => void }) {
  const { state, mySeat } = useGame();
  const seat = mySeat ?? currentActor(state); // online: always my hand; hotseat: the acting player
  const me = state.players[seat];
  if (!me) return null; // spectator (no claimed seat)
  const canPlay = (c: PlayerDevCard) =>
    onPlayDev !== undefined &&
    c.type !== "victoryPoint" &&
    !c.boughtThisTurn &&
    !c.played &&
    !state.turn.devCardPlayedThisTurn;

  return (
    <div className="hand-panel">
      <h2>{me.name}</h2>
      <ul className="resources" aria-label="Resources">
        {RESOURCE_LIST.map((r) => (
          <li key={r} data-testid={`res-${r}`}>{r}: {me.resources[r]}</li>
        ))}
      </ul>
      <ul className="dev-cards" aria-label="Development cards">
        {me.devCards.map((c, i) => (
          <li key={i} data-dev={c.type}>
            {onPlayDev ? (
              <button disabled={!canPlay(c)} onClick={() => onPlayDev(c.type)}>{c.type}</button>
            ) : (
              c.type
            )}
          </li>
        ))}
      </ul>
      <CostReference />
    </div>
  );
}

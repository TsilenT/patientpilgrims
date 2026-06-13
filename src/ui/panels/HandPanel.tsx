import { useGame } from "../../state/GameProvider";
import { currentActor } from "../../state/viewModel";
import { totalVictoryPoints } from "../../engine";
import { RESOURCE_LIST } from "../../engine/resources";
import { RESOURCE_ICON } from "../icons";
import type { PlayerDevCard } from "../../engine/types";
import type { DevCardType } from "../../engine/devcards";
import { CostReference } from "./CostReference";

export function HandPanel({ onPlayDev }: { onPlayDev?: (type: DevCardType) => void }) {
  const { state, mySeat } = useGame();
  const seat = mySeat ?? currentActor(state); // online: always my hand; hotseat: the acting player
  const me = state.players[seat];
  if (!me) return null; // spectator (no claimed seat)
  const publicVp = me.victoryPoints;
  const totalVp = totalVictoryPoints(state, seat);
  const cardVp = totalVp - publicVp;
  const canPlay = (c: PlayerDevCard) =>
    onPlayDev !== undefined &&
    c.type !== "victoryPoint" &&
    !c.boughtThisTurn &&
    !c.played &&
    !state.turn.devCardPlayedThisTurn;
  const cardStatus = (c: PlayerDevCard): "active" | "blocked" | "played" => {
    if (c.played) return "played";
    if (c.type === "victoryPoint" || canPlay(c)) return "active";
    return "blocked";
  };
  const handCards = me.devCards.map((card, index) => ({ card, index })).filter(({ card }) => !card.played);
  const playedCards = me.devCards.map((card, index) => ({ card, index })).filter(({ card }) => card.played);

  return (
    <div className="hand-panel">
      <h2>{me.name}</h2>
      <div className="vp-summary" data-testid="hand-vp-summary" aria-label="Victory points">
        {totalVp} VP
        {cardVp > 0 ? ` (${publicVp} public + ${cardVp} from victory-point cards)` : null}
      </div>
      <ul className="resources" aria-label="Resources">
        {RESOURCE_LIST.map((r) => (
          <li key={r} data-testid={`res-${r}`} className="res-chip" title={r}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span> {me.resources[r]}
          </li>
        ))}
      </ul>
      <div className="dev-card-section">
        <h3>Hand</h3>
        <ul className="dev-cards" aria-label="Development hand">
          {handCards.map(({ card: c, index }) => {
            const status = cardStatus(c);
            return (
              <li key={index} data-dev={c.type} data-testid={`dev-card-${c.type}-${index}`}
                className={`dev-card dev-card--${status}`}>
                {onPlayDev && c.type !== "victoryPoint" ? (
                  <button disabled={status !== "active"} onClick={() => onPlayDev(c.type)}>{c.type}</button>
                ) : (
                  <span className="dev-card-chip">{c.type}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {playedCards.length > 0 && (
        <div className="dev-card-section dev-card-section--played">
          <h3>Played</h3>
          <ul className="dev-cards dev-cards--played" aria-label="Played development cards">
            {playedCards.map(({ card: c, index }) => (
              <li key={index} data-dev={c.type} data-testid={`dev-card-${c.type}-${index}`}
                className="dev-card dev-card--played">
                <span className="dev-card-chip">{c.type}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CostReference />
    </div>
  );
}

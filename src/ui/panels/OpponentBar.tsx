import { useGame } from "../../state/GameProvider";
import { currentActor, opponentsOf } from "../../state/viewModel";

export function OpponentBar() {
  const { state } = useGame();
  const viewer = currentActor(state);
  const opponents = opponentsOf(state, viewer);
  return (
    <div className="opponent-bar">
      {opponents.map((o) => (
        <div key={o.seat} className="opponent" data-seat={o.seat}
          data-active={state.turn.activeSeat === o.seat}>
          <span className="opp-name" style={{ color: o.color }}>{o.name}</span>
          <span data-testid={`opp-${o.seat}-resources`}>cards {o.resourceCount}</span>
          <span data-testid={`opp-${o.seat}-dev`}>dev {o.devCardCount}</span>
          <span data-testid={`opp-${o.seat}-vp`}>VP {o.victoryPoints}</span>
          <span>knights {o.knightsPlayed}</span>
          <span>road {o.longestRoadLength}</span>
          {o.hasLargestArmy && <span className="award" title="Largest Army">LA</span>}
          {o.hasLongestRoad && <span className="award" title="Longest Road">LR</span>}
        </div>
      ))}
    </div>
  );
}

import { useGame } from "../../state/GameProvider";
import { currentActor, opponentsOf } from "../../state/viewModel";

export function OpponentBar() {
  const { state, mySeat } = useGame();
  const viewer = mySeat ?? currentActor(state); // online: opponents are everyone but me
  const opponents = opponentsOf(state, viewer);
  return (
    <div className="opponent-bar">
      {opponents.map((o) => (
        <div key={o.seat} className="opponent" data-seat={o.seat}
          data-active={state.turn.activeSeat === o.seat}>
          <span className="opp-name" style={{ color: o.color }}>{o.name}</span>
          <span data-testid={`opp-${o.seat}-resources`} title="Resource cards">C {o.resourceCount}</span>
          <span data-testid={`opp-${o.seat}-dev`} title="Development cards">D {o.devCardCount}</span>
          <span data-testid={`opp-${o.seat}-vp`} title="Victory points">VP {o.victoryPoints}</span>
          <span title="Knights played">K {o.knightsPlayed}</span>
          <span title="Longest road length">R {o.longestRoadLength}</span>
          {o.hasLargestArmy && <span className="award" title="Largest Army">LA</span>}
          {o.hasLongestRoad && <span className="award" title="Longest Road">LR</span>}
        </div>
      ))}
    </div>
  );
}

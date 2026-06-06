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
          <span className="swatch" style={{ background: o.color }} aria-hidden="true" />
          <span className="opp-name">{o.name}</span>
          <span className="vp-pill" data-testid={`opp-${o.seat}-vp`} title="Victory points">{o.victoryPoints} VP</span>
          <span className="opp-stat" data-testid={`opp-${o.seat}-resources`} title="Resource cards">🃏 {o.resourceCount}</span>
          <span className="opp-stat" data-testid={`opp-${o.seat}-dev`} title="Development cards">📜 {o.devCardCount}</span>
          <span className="opp-stat" title="Knights played">⚔️ {o.knightsPlayed}</span>
          <span className="opp-stat" title="Longest road length">🛣️ {o.longestRoadLength}</span>
          {o.hasLargestArmy && <span className="award" title="Largest Army">LA</span>}
          {o.hasLongestRoad && <span className="award" title="Longest Road">LR</span>}
        </div>
      ))}
    </div>
  );
}

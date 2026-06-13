import type { CSSProperties } from "react";
import { useGame } from "../../state/GameProvider";
import { currentActor, opponentsOf } from "../../state/viewModel";
import { CardsIcon, DevCardBackIcon, KnightIcon, RoadIcon } from "../icons";

export function OpponentBar() {
  const { state, mySeat } = useGame();
  const viewer = mySeat ?? currentActor(state); // online: opponents are everyone but me
  const opponents = opponentsOf(state, viewer);
  // Cards render straight into the .top-hud grid so the dice can fill the empty cell.
  return (
    <>
      {opponents.map((o) => {
        const active = state.turn.activeSeat === o.seat;
        return (
          <div key={o.seat} className="opponent" data-seat={o.seat} data-active={active}
            style={{ "--seat-color": o.color } as CSSProperties}>
            <div className="opp-top">
              <span className="swatch" style={{ background: o.color }} aria-hidden="true" />
              <span className="opp-name">{o.name}</span>
              <span className="vp-pill" data-testid={`opp-${o.seat}-vp`} title="Victory points">
                {o.victoryPoints}<span className="vp-label">VP</span>
              </span>
            </div>
            <div className="opp-stats">
              <span className="opp-stat" data-testid={`opp-${o.seat}-resources`} title="Resource cards">
                <CardsIcon /> {o.resourceCount}
              </span>
              <span className="opp-stat" data-testid={`opp-${o.seat}-dev`} title="Development cards">
                <DevCardBackIcon /> {o.devCardCount}
              </span>
              <span className={`opp-stat${o.hasLargestArmy ? " is-award" : ""}`}
                title={o.hasLargestArmy ? "Largest Army (3+ knights)" : "Knights played"}>
                <KnightIcon /> {o.knightsPlayed}
              </span>
              <span className={`opp-stat${o.hasLongestRoad ? " is-award" : ""}`}
                title={o.hasLongestRoad ? "Longest Road" : "Longest road length"}>
                <RoadIcon /> {o.longestRoadLength}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

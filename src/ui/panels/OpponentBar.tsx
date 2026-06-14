import type { CSSProperties } from "react";
import { useGame } from "../../state/GameProvider";
import { currentActor, opponentsOf, type OpponentView } from "../../state/viewModel";
import { CardsIcon, DevCardBackIcon, KnightIcon, RoadIcon } from "../icons";
import { useGainPulse } from "../useGainPulse";

function OpponentCard({ o, active }: { o: OpponentView; active: boolean }) {
  const gained = useGainPulse(o.seat);
  const total = gained ? Object.values(gained).reduce((a, b) => a + (b ?? 0), 0) : 0;
  return (
    <div className="opponent" data-seat={o.seat} data-active={active}
      style={{ "--seat-color": o.color } as CSSProperties}>
      <div className="opp-top">
        <span className="swatch" style={{ background: o.color }} aria-hidden="true" />
        <span className="opp-name">{o.name}</span>
        <span className="vp-pill" data-testid={`opp-${o.seat}-vp`} title="Victory points">
          {o.victoryPoints}<span className="vp-label">VP</span>
        </span>
      </div>
      <div className="opp-stats">
        <span className={total > 0 ? "opp-stat opp-stat--gain" : "opp-stat"}
          data-testid={`opp-${o.seat}-resources`} title="Resource cards">
          <CardsIcon /> {o.resourceCount}
          {total > 0 && <span className="gain-float">+{total}</span>}
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
}

export function OpponentBar() {
  const { state, mySeat } = useGame();
  const viewer = mySeat ?? currentActor(state); // online: opponents are everyone but me
  const opponents = opponentsOf(state, viewer);
  // Cards render straight into the .top-hud grid so the dice can fill the empty cell.
  return (
    <>
      {opponents.map((o) => (
        <OpponentCard key={o.seat} o={o} active={state.turn.activeSeat === o.seat} />
      ))}
    </>
  );
}

import { useGame } from "../../state/GameProvider";
import { totalVictoryPoints } from "../../engine";
import { RESOURCE_LIST } from "../../engine/resources";
import { RESOURCE_ICON, DevCardBackIcon } from "../icons";

/** One-line hand summary shown while the bottom sheet is collapsed. */
export function SheetPeek({ seat }: { seat: number }) {
  const { state } = useGame();
  const me = state.players[seat];
  if (!me) return null; // spectator (no claimed seat)
  const devCards = me.devCards.filter((c) => !c.played).length;
  return (
    <div className="sheet-peek" aria-label="Hand summary">
      {RESOURCE_LIST.map((r) => {
        const ResIcon = RESOURCE_ICON[r];
        return (
          <span key={r} className="peek-stat" data-res={r} title={r}>
            <ResIcon className="res-icon" /> {me.resources[r]}
          </span>
        );
      })}
      <span className="peek-stat peek-stat--dev" title="Development cards">
        <DevCardBackIcon className="res-icon" /> {devCards}
      </span>
      <span className="peek-vp" title="Victory points">{totalVictoryPoints(state, seat)} VP</span>
    </div>
  );
}

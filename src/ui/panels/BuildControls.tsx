import { useGame } from "../../state/GameProvider";
import { buildTargetCount } from "../../state/legalTargets";
import { canAfford, COSTS } from "../../engine";

export type BuildMode = "road" | "settlement" | "city" | null;

const OPTIONS: { mode: "road" | "settlement" | "city"; label: string; hint: string }[] = [
  { mode: "road", label: "🛣️ Road", hint: "Costs 1 wood, 1 brick" },
  { mode: "settlement", label: "🏠 Settlement", hint: "Costs 1 wood, 1 brick, 1 sheep, 1 wheat" },
  { mode: "city", label: "🏙️ City", hint: "Upgrade a settlement — costs 2 wheat, 3 ore" },
];

/** Main-phase build selector + placement prompt. Renders nothing outside the main phase. */
export function BuildControls({ buildMode, onSelect, onCancel }: {
  buildMode: BuildMode;
  onSelect: (m: "road" | "settlement" | "city") => void;
  onCancel: () => void;
}) {
  const { state } = useGame();
  if (state.turn.subPhase !== "main") return null;

  if (buildMode !== null) {
    return (
      <div className="build-controls" role="group" aria-label="Placing a build">
        <span className="build-prompt">Tap a spot to build a {buildMode}</span>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  const me = state.players[state.turn.activeSeat]!;
  return (
    <div className="build-controls" role="group" aria-label="Build">
      {OPTIONS.map(({ mode, label, hint }) => {
        const enabled = canAfford(me.resources, COSTS[mode]) && buildTargetCount(state, mode) > 0;
        return (
          <button key={mode} disabled={!enabled} title={hint} onClick={() => onSelect(mode)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

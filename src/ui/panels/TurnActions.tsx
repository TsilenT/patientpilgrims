import { canAfford, COSTS } from "../../engine";
import { DEV_CARD_COST } from "../../engine/devcards";
import { RESOURCE_LIST, type ResourceMap } from "../../engine/resources";
import { buildTargetCount } from "../../state/legalTargets";
import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";
import { BUILD_ICON, DevCardBackIcon, DiceIcon, ResTile } from "../icons";

export type BuildMode = "road" | "settlement" | "city" | null;

function CostDots({ cost }: { cost: ResourceMap }) {
  return (
    <span className="chip-cost" aria-hidden="true">
      {RESOURCE_LIST.flatMap((r) =>
        Array.from({ length: cost[r] }, (_, i) => <ResTile key={`${r}${i}`} r={r} />),
      )}
    </span>
  );
}

/**
 * The turn dock: a purchases row (builds + dev card, each wearing its cost)
 * and one primary button that morphs Roll → End Turn in a stable slot.
 * Renders nothing outside the roll/main sub-phases.
 */
export function TurnActions({ buildMode, onSelectBuild, onCancelBuild }: {
  buildMode: BuildMode;
  onSelectBuild: (m: "road" | "settlement" | "city") => void;
  onCancelBuild: () => void;
}) {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;
  if (sub !== "awaitingRoll" && sub !== "main") return null;

  if (buildMode !== null) {
    return (
      <div className="turn-actions" role="group" aria-label="Placing a build">
        <div className="build-controls">
          <span className="build-prompt">Tap a spot to build a {buildMode}</span>
          <button onClick={onCancelBuild}>Cancel</button>
        </div>
      </div>
    );
  }

  const me = state.players[state.turn.activeSeat]!;
  const rolled = sub === "main";
  const rollFirst = "Roll the dice first";
  const builds = [
    {
      mode: "road" as const, label: "Road", cost: COSTS.road,
      hint: `Build a road (${me.pieces.roads} left). Costs wood, brick.`,
    },
    {
      mode: "settlement" as const, label: "Settlement", cost: COSTS.settlement,
      hint: `Build a settlement (${me.pieces.settlements} left). Costs wood, brick, sheep, wheat.`,
    },
    {
      mode: "city" as const, label: "City", cost: COSTS.city,
      hint: `Upgrade a settlement (${me.pieces.cities} left). Costs 2 wheat, 3 ore.`,
    },
  ];
  const canBuyDev = rolled && canAfford(me.resources, DEV_CARD_COST) && state.devDeck.length > 0;

  return (
    <div className="turn-actions">
      <div className="purchases" role="group" aria-label="Build and buy">
        {builds.map(({ mode, label, cost, hint }) => {
          const BuildIcon = BUILD_ICON[mode];
          const enabled = rolled && canAfford(me.resources, cost) && buildTargetCount(state, mode) > 0;
          return (
            <button key={mode} className="chip" disabled={!enabled}
              title={rolled ? hint : rollFirst} onClick={() => onSelectBuild(mode)}>
              <BuildIcon className="chip-icon" />
              <span className="chip-label">{label}</span>
              <CostDots cost={cost} />
            </button>
          );
        })}
        <button className="chip" disabled={!canBuyDev} aria-label="Dev Card"
          title={rolled ? `Buy a development card (${state.devDeck.length} left). Costs sheep, wheat, ore.` : rollFirst}
          onClick={() => run({ type: "buyDevCard" })}>
          <span className="chip-count">{state.devDeck.length}</span>
          <DevCardBackIcon className="chip-icon" />
          <span className="chip-label">Dev Card</span>
          <CostDots cost={DEV_CARD_COST} />
        </button>
      </div>
      <div className="turn-primary">
        {rolled ? (
          <button className="btn-primary" title="Finish your turn and pass to the next player"
            onClick={() => run({ type: "endTurn" })}>End Turn</button>
        ) : (
          <button className="btn-primary" onClick={() => run({ type: "rollDice" })}>
            <DiceIcon className="btn-icon" /> Roll
          </button>
        )}
      </div>
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

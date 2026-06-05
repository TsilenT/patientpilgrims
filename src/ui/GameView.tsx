import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { useDispatchWithError } from "./useDispatchWithError";
import { legalTargets } from "../state/legalTargets";
import { currentActor } from "../state/viewModel";
import { BoardSvg } from "./board/BoardSvg";
import { HandPanel } from "./panels/HandPanel";
import { ActionBar } from "./panels/ActionBar";
import { PassDeviceScreen } from "./overlays/PassDeviceScreen";
import { Toast } from "./Toast";

export function GameView() {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const legal = legalTargets(state);

  const sub = state.turn.subPhase;
  const actor = currentActor(state);
  const [revealedSeat, setRevealedSeat] = useState(actor);

  const onVertex = (v: string) => {
    if (sub === "setupSettlement") return run({ type: "setupSettlement", vertex: v });
    if (sub === "main") {
      const b = state.board.buildings[v];
      if (b && b.owner === state.turn.activeSeat && b.type === "settlement") return run({ type: "buildCity", vertex: v });
      return run({ type: "buildSettlement", vertex: v });
    }
  };
  const onEdge = (e: string) => {
    if (sub === "setupRoad") return run({ type: "setupRoad", edge: e });
    if (sub === "main") return run({ type: "buildRoad", edge: e });
  };
  const onHex = (h: string) => { if (sub === "movingRobber") run({ type: "moveRobber", hex: h }); };

  return (
    <div className="game-view">
      <BoardSvg state={state} legal={legal} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
      {actor !== revealedSeat ? (
        <PassDeviceScreen name={state.players[actor]!.name} onReveal={() => setRevealedSeat(actor)} />
      ) : (
        <>
          <HandPanel />
          <ActionBar />
        </>
      )}
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

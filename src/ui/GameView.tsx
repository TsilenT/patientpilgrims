import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { useDispatchWithError } from "./useDispatchWithError";
import { legalTargets, legalRoadBuildingEdges } from "../state/legalTargets";
import { currentActor, eligibleVictims } from "../state/viewModel";
import { BoardSvg } from "./board/BoardSvg";
import { HandPanel } from "./panels/HandPanel";
import { ActionBar } from "./panels/ActionBar";
import { OpponentBar } from "./panels/OpponentBar";
import { LogRail } from "./panels/LogRail";
import { PassDeviceScreen } from "./overlays/PassDeviceScreen";
import { RobberVictimPicker } from "./overlays/RobberVictimPicker";
import { DiscardModal } from "./overlays/DiscardModal";
import { MonopolyPicker, YearOfPlentyPicker } from "./overlays/DevCardModals";
import { GameOverBanner } from "./overlays/GameOverBanner";
import { Toast } from "./Toast";
import type { DevCardType } from "../engine/devcards";

export function GameView() {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;
  const actor = currentActor(state);
  const owed = state.discardObligations?.[actor] ?? 0;
  const [revealedSeat, setRevealedSeat] = useState(actor);
  const [robberPick, setRobberPick] = useState<{ hex: string; victims: number[] } | null>(null);
  const [devModal, setDevModal] = useState<"monopoly" | "yearOfPlenty" | null>(null);
  const [roadEdges, setRoadEdges] = useState<string[] | null>(null);

  // While a Road Building card is being placed, the board highlights its legal edges.
  const legal = roadEdges !== null
    ? { vertices: new Set<string>(), edges: legalRoadBuildingEdges(state, roadEdges), hexes: new Set<string>() }
    : legalTargets(state);

  const onVertex = (v: string) => {
    if (sub === "setupSettlement") return run({ type: "setupSettlement", vertex: v });
    if (sub === "main") {
      const b = state.board.buildings[v];
      if (b && b.owner === state.turn.activeSeat && b.type === "settlement") return run({ type: "buildCity", vertex: v });
      return run({ type: "buildSettlement", vertex: v });
    }
  };
  const onEdge = (e: string) => {
    if (roadEdges !== null) {
      const next = [...roadEdges, e];
      if (next.length >= 2) { run({ type: "playRoadBuilding", edges: next }); setRoadEdges(null); }
      else setRoadEdges(next);
      return;
    }
    if (sub === "setupRoad") return run({ type: "setupRoad", edge: e });
    if (sub === "main") return run({ type: "buildRoad", edge: e });
  };
  const onHex = (h: string) => {
    if (sub !== "movingRobber") return;
    const victims = eligibleVictims(state, h);
    if (victims.length === 0) run({ type: "moveRobber", hex: h });
    else if (victims.length === 1) run({ type: "moveRobber", hex: h, victim: victims[0]! });
    else setRobberPick({ hex: h, victims });
  };

  const onPlayDev = (type: DevCardType) => {
    if (type === "knight") return run({ type: "playKnight" });
    if (type === "monopoly") return setDevModal("monopoly");
    if (type === "yearOfPlenty") return setDevModal("yearOfPlenty");
    if (type === "roadBuilding") return setRoadEdges([]);
  };

  return (
    <div className="game-view">
      <OpponentBar />
      <BoardSvg state={state} legal={legal} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
      {actor !== revealedSeat ? (
        <PassDeviceScreen name={state.players[actor]!.name} onReveal={() => setRevealedSeat(actor)} />
      ) : owed > 0 ? (
        <DiscardModal state={state} seat={actor} owed={owed}
          onDiscard={(cards) => run({ type: "discard", seat: actor, cards })} />
      ) : (
        <>
          <HandPanel onPlayDev={onPlayDev} />
          <ActionBar />
        </>
      )}
      {roadEdges !== null && (
        <div className="road-building" role="dialog" aria-modal="true" aria-label="Road building">
          <p>Place up to 2 roads ({roadEdges.length}/2)</p>
          <button disabled={roadEdges.length < 1}
            onClick={() => { run({ type: "playRoadBuilding", edges: roadEdges }); setRoadEdges(null); }}>Confirm</button>
          <button onClick={() => setRoadEdges(null)}>Cancel</button>
        </div>
      )}
      {devModal === "monopoly" && (
        <MonopolyPicker onCancel={() => setDevModal(null)}
          onPick={(r) => { run({ type: "playMonopoly", resource: r }); setDevModal(null); }} />
      )}
      {devModal === "yearOfPlenty" && (
        <YearOfPlentyPicker onCancel={() => setDevModal(null)}
          onPick={(rs) => { run({ type: "playYearOfPlenty", resources: rs }); setDevModal(null); }} />
      )}
      {robberPick && sub === "movingRobber" && (
        <RobberVictimPicker state={state} victims={robberPick.victims}
          onPick={(victim) => { run({ type: "moveRobber", hex: robberPick.hex, victim }); setRobberPick(null); }} />
      )}
      <LogRail />
      <GameOverBanner />
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

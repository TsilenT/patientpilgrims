import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { useDispatchWithError } from "./useDispatchWithError";
import { legalTargets, legalRoadBuildingEdges } from "../state/legalTargets";
import { currentActor, eligibleVictims } from "../state/viewModel";
import { BoardSvg } from "./board/BoardSvg";
import { HandPanel } from "./panels/HandPanel";
import { ActionBar } from "./panels/ActionBar";
import { DiceSummary } from "./panels/DiceSummary";
import { OpponentBar } from "./panels/OpponentBar";
import { LogRail } from "./panels/LogRail";
import { TradePanel } from "./panels/TradePanel";
import { PassDeviceScreen } from "./overlays/PassDeviceScreen";
import { RobberVictimPicker } from "./overlays/RobberVictimPicker";
import { DiscardModal } from "./overlays/DiscardModal";
import { MonopolyPicker, YearOfPlentyPicker } from "./overlays/DevCardModals";
import { GameOverBanner } from "./overlays/GameOverBanner";
import { Toast } from "./Toast";
import type { DevCardType } from "../engine/devcards";

const NO_TARGETS = { vertices: new Set<string>(), edges: new Set<string>(), hexes: new Set<string>() };

export function GameView() {
  const { state, mySeat } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;
  const online = mySeat !== null;
  const actor = currentActor(state);
  const viewer = mySeat ?? actor; // perspective: online → my seat; hotseat → the acting player
  const owed = state.discardObligations?.[viewer] ?? 0;
  const [revealedSeat, setRevealedSeat] = useState(actor);
  const [robberPick, setRobberPick] = useState<{ hex: string; victims: number[] } | null>(null);
  const [devModal, setDevModal] = useState<"monopoly" | "yearOfPlenty" | null>(null);
  const [roadEdges, setRoadEdges] = useState<string[] | null>(null);
  const [tab, setTab] = useState<"hand" | "trades" | "log">("hand");

  // Turn gating. Hotseat keeps the pass-the-device flow; online locks to your own seat.
  const needReveal = !online && actor !== revealedSeat;
  const myTurn = online ? state.turn.activeSeat === mySeat : true;
  const waiting = online && !myTurn && owed === 0; // not your turn, nothing owed → read-only
  const interactive = !needReveal && !waiting && owed === 0;

  // While a Road Building card is being placed, the board highlights its legal edges.
  const legal = !interactive
    ? NO_TARGETS
    : roadEdges !== null
      ? { vertices: new Set<string>(), edges: legalRoadBuildingEdges(state, roadEdges), hexes: new Set<string>() }
      : legalTargets(state);

  const onVertex = (v: string) => {
    if (!interactive) return;
    if (sub === "setupSettlement") return run({ type: "setupSettlement", vertex: v });
    if (sub === "main") {
      const b = state.board.buildings[v];
      if (b && b.owner === state.turn.activeSeat && b.type === "settlement") return run({ type: "buildCity", vertex: v });
      return run({ type: "buildSettlement", vertex: v });
    }
  };
  const onEdge = (e: string) => {
    if (!interactive) return;
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
    if (!interactive || sub !== "movingRobber") return;
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
      <div className="top-hud">
        <OpponentBar />
        <DiceSummary />
      </div>
      <BoardSvg state={state} legal={legal} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
      {needReveal ? (
        <PassDeviceScreen name={state.players[actor]!.name} onReveal={() => setRevealedSeat(actor)} />
      ) : waiting ? (
        <>
          <div className="waiting-banner" role="status">
            Waiting for <strong>{state.players[state.turn.activeSeat]!.name}</strong>…
          </div>
          <div className="bottom-sheet">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "log"} onClick={() => setTab("log")}>Log</button>
              {sub === "main" && <button role="tab" aria-selected={tab === "trades"} onClick={() => setTab("trades")}>Trades</button>}
              <button role="tab" aria-selected={tab === "hand"} onClick={() => setTab("hand")}>Your hand</button>
            </div>
            <div className="tab-content" role="tabpanel" aria-label={tab}>
              {tab === "log" && <LogRail />}
              {tab === "trades" && (sub === "main" ? <TradePanel /> : <p>Trades open after the active player rolls.</p>)}
              {tab === "hand" && <HandPanel />}
            </div>
          </div>
        </>
      ) : owed > 0 ? (
        <DiscardModal state={state} seat={viewer} owed={owed}
          onDiscard={(cards) => run({ type: "discard", seat: viewer, cards })} />
      ) : (
        <>
          <ActionBar />
          <div className="bottom-sheet">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "hand"} onClick={() => setTab("hand")}>Hand</button>
              <button role="tab" aria-selected={tab === "trades"} onClick={() => setTab("trades")}>Trades</button>
              <button role="tab" aria-selected={tab === "log"} onClick={() => setTab("log")}>Log</button>
            </div>
            <div className="tab-content" role="tabpanel" aria-label={tab}>
              {tab === "hand" && <HandPanel onPlayDev={onPlayDev} />}
              {tab === "trades" && (sub === "main" ? <TradePanel /> : <p>Trades open after you roll.</p>)}
              {tab === "log" && <LogRail />}
            </div>
          </div>
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
      <GameOverBanner />
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

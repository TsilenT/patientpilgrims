import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { useDispatchWithError } from "./useDispatchWithError";
import { legalTargets, legalRoadBuildingEdges, buildTargets } from "../state/legalTargets";
import { currentActor, eligibleVictims } from "../state/viewModel";
import { BoardSvg } from "./board/BoardSvg";
import { HandPanel } from "./panels/HandPanel";
import { ActionBar } from "./panels/ActionBar";
import { BuildControls, type BuildMode } from "./panels/BuildControls";
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
  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [tab, setTab] = useState<"hand" | "trades" | "log">("hand");

  // Turn gating. Hotseat keeps the pass-the-device flow; online locks to your own seat.
  const needReveal = !online && actor !== revealedSeat;
  const myTurn = online ? state.turn.activeSeat === mySeat : true;
  const waiting = online && !myTurn && owed === 0; // not your turn, nothing owed → read-only
  const interactive = !needReveal && !waiting && owed === 0;
  const placingRobber = interactive && sub === "movingRobber";

  // Setup forces the build type; the main phase uses the player's selection.
  const effectiveMode: BuildMode =
    sub === "setupSettlement" ? "settlement"
    : sub === "setupRoad" ? "road"
    : buildMode;

  const legal = !interactive
    ? NO_TARGETS
    : roadEdges !== null
      ? { vertices: new Set<string>(), edges: legalRoadBuildingEdges(state, roadEdges), hexes: new Set<string>() }
      : sub === "movingRobber"
        ? legalTargets(state) // robber hex overlay
        : effectiveMode !== null
          ? buildTargets(state, effectiveMode)
          : NO_TARGETS; // main-phase neutral → board read-only

  const finishBuild = (ok: boolean) => { if (ok) setBuildMode(null); };

  const onVertex = async (v: string) => {
    if (!interactive || roadEdges !== null) return;
    if (effectiveMode === "settlement") {
      if (sub === "setupSettlement") { await run({ type: "setupSettlement", vertex: v }); return; }
      if (sub === "main") { const r = await run({ type: "buildSettlement", vertex: v }); finishBuild(r.ok); }
      return;
    }
    if (effectiveMode === "city" && sub === "main") {
      const r = await run({ type: "buildCity", vertex: v }); finishBuild(r.ok);
    }
  };
  const onEdge = async (e: string) => {
    if (!interactive) return;
    if (roadEdges !== null) {
      const next = [...roadEdges, e];
      if (next.length >= 2) { await run({ type: "playRoadBuilding", edges: next }); setRoadEdges(null); }
      else setRoadEdges(next);
      return;
    }
    if (effectiveMode !== "road") return;
    if (sub === "setupRoad") { await run({ type: "setupRoad", edge: e }); return; }
    if (sub === "main") { const r = await run({ type: "buildRoad", edge: e }); finishBuild(r.ok); }
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
      {placingRobber && (
        <div className="robber-placement-banner" role="status" aria-label="Robber placement">
          <strong>Roll 7: Move the robber</strong>
          <span>Choose a highlighted hex to block production and steal from an adjacent player.</span>
        </div>
      )}
      <BoardSvg state={state} legal={legal} robberPlacement={placingRobber}
        onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
      {needReveal ? (
        <PassDeviceScreen name={state.players[actor]!.name} onReveal={() => setRevealedSeat(actor)} />
      ) : waiting ? (
        <>
          <div className="waiting-banner" role="status">
            {`Waiting for ${state.players[state.turn.activeSeat]!.name}…`}
          </div>
          <div className="bottom-sheet">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "hand"} onClick={() => setTab("hand")}>Your hand</button>
              {sub === "main" && <button role="tab" aria-selected={tab === "trades"} onClick={() => setTab("trades")}>Trades</button>}
              <button role="tab" aria-selected={tab === "log"} onClick={() => setTab("log")}>Log</button>
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
          {buildMode === null && <ActionBar />}
          <BuildControls buildMode={buildMode} onSelect={setBuildMode} onCancel={() => setBuildMode(null)} />
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

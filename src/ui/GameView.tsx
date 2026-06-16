import { useEffect, useState } from "react";
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
import { WinScreen } from "./overlays/WinScreen";
import { OrderRollReveal } from "./overlays/OrderRollReveal";
import { HostLinksPanel } from "./overlays/HostLinksPanel";
import { hostRescueLinks, loadRescueLinks } from "../net/lobby";
import { parseRoute } from "../app/router";
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
  const [pendingSetup, setPendingSetup] = useState<
    | { kind: "settlement"; vertex: string }
    | { kind: "road"; edge: string }
    | null
  >(null);
  const [tab, setTab] = useState<"hand" | "trades" | "log" | "links">("hand");

  const r = parseRoute(location.hash);
  const gameId = online && r.kind === "game" ? r.id : null;
  const [rescueLinks, setRescueLinks] = useState(() => gameId !== null ? hostRescueLinks(gameId) : null);

  useEffect(() => {
    let cancelled = false;
    if (gameId === null) {
      setRescueLinks(null);
      return () => { cancelled = true; };
    }
    setRescueLinks(hostRescueLinks(gameId));
    void loadRescueLinks(gameId).then((links) => {
      if (!cancelled) setRescueLinks(links);
    }).catch(() => {
      if (!cancelled) setRescueLinks(hostRescueLinks(gameId));
    });
    return () => { cancelled = true; };
  }, [gameId]);

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
      if (sub === "setupSettlement") { setPendingSetup({ kind: "settlement", vertex: v }); return; }
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
    if (sub === "setupRoad") { setPendingSetup({ kind: "road", edge: e }); return; }
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

  const confirmSetupPlacement = async () => {
    if (pendingSetup === null) return;
    const result = pendingSetup.kind === "settlement"
      ? await run({ type: "setupSettlement", vertex: pendingSetup.vertex })
      : await run({ type: "setupRoad", edge: pendingSetup.edge });
    if (result.ok) setPendingSetup(null);
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
              <button role="tab" aria-selected={tab === "trades"} onClick={() => setTab("trades")}>Trades</button>
              <button role="tab" aria-selected={tab === "log"} onClick={() => setTab("log")}>Log</button>
              {gameId !== null && <button role="tab" aria-selected={tab === "links"} onClick={() => setTab("links")}>Links</button>}
            </div>
            <div className="tab-content" role="tabpanel" aria-label={tab}>
              {tab === "log" && <LogRail />}
              {tab === "trades" && <TradePanel />}
              {tab === "hand" && <HandPanel />}
              {tab === "links" && gameId !== null && (rescueLinks !== null
                ? <HostLinksPanel id={gameId} links={rescueLinks} />
                : <p>Recovery links are loading…</p>)}
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
              {gameId !== null && <button role="tab" aria-selected={tab === "links"} onClick={() => setTab("links")}>Links</button>}
            </div>
            <div className="tab-content" role="tabpanel" aria-label={tab}>
              {tab === "hand" && <HandPanel onPlayDev={onPlayDev} />}
              {tab === "trades" && <TradePanel />}
              {tab === "log" && <LogRail />}
              {tab === "links" && gameId !== null && (rescueLinks !== null
                ? <HostLinksPanel id={gameId} links={rescueLinks} />
                : <p>Recovery links are loading…</p>)}
            </div>
          </div>
        </>
      )}
      {pendingSetup !== null && (
        <div className="setup-confirm" role="dialog" aria-modal="true" aria-label="Confirm placement">
          <p>
            Confirm {pendingSetup.kind} placement?
          </p>
          <button className="btn-primary" onClick={() => { void confirmSetupPlacement(); }}>
            Confirm
          </button>
          <button onClick={() => setPendingSetup(null)}>Cancel</button>
        </div>
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
      <OrderRollReveal />
      <WinScreen />
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

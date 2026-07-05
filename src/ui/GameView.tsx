import { useEffect, useState } from "react";
import { useGame } from "../state/GameProvider";
import { useDispatchWithError } from "./useDispatchWithError";
import { legalTargets, legalRoadBuildingEdges, buildTargets } from "../state/legalTargets";
import { currentActor, eligibleVictims } from "../state/viewModel";
import { BoardSvg } from "./board/BoardSvg";
import { HandPanel } from "./panels/HandPanel";
import { SheetPeek } from "./panels/SheetPeek";
import { BottomSheet, clampSheetHeight, type SheetTab } from "./panels/BottomSheet";
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
const SHEET_HEIGHT_KEY = "adultingcatan:sheetHeight";

function tradesTabLabel(openTradeCount: number) {
  return openTradeCount > 0 ? `Trades (${openTradeCount})` : "Trades";
}

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
  const [pendingRobberHex, setPendingRobberHex] = useState<string | null>(null);
  const [pendingKnight, setPendingKnight] = useState(false);
  const [devModal, setDevModal] = useState<"monopoly" | "yearOfPlenty" | null>(null);
  const [roadEdges, setRoadEdges] = useState<string[] | null>(null);
  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [pendingSetup, setPendingSetup] = useState<
    | { kind: "settlement"; vertex: string }
    | { kind: "road"; edge: string }
    | null
  >(null);
  const [tab, setTab] = useState<SheetTab>("hand");
  // Phones start with the sheet collapsed so the board dominates; wide screens
  // (side-rail layout) and environments without matchMedia (jsdom) start open.
  const [sheetOpen, setSheetOpen] = useState(() =>
    typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 900px)").matches : true,
  );
  const [sheetHeight, setSheetHeight] = useState(() => {
    const saved = Number(localStorage.getItem(SHEET_HEIGHT_KEY));
    if (Number.isFinite(saved) && saved > 0) return clampSheetHeight(saved);
    // Default: ~40% of the screen — enough for a form, board still readable.
    return clampSheetHeight(Math.round((window.innerHeight || 800) * 0.4));
  });
  const changeSheetHeight = (px: number) => {
    setSheetHeight(px);
    try { localStorage.setItem(SHEET_HEIGHT_KEY, String(px)); } catch { /* private mode */ }
  };
  const selectTab = (t: SheetTab) => {
    if (sheetOpen && tab === t) { setSheetOpen(false); return; } // tap the active tab to collapse
    setTab(t);
    setSheetOpen(true);
  };

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

  useEffect(() => {
    if (sub !== "movingRobber" && !pendingKnight) {
      setPendingRobberHex(null);
      setRobberPick(null);
    }
  }, [sub, pendingKnight]);

  // Robber placement (a rolled 7) needs the board: collapse the sheet.
  useEffect(() => {
    if (sub === "movingRobber") setSheetOpen(false);
  }, [sub]);

  // Turn gating. Hotseat keeps the pass-the-device flow; online locks to your own seat.
  const needReveal = !online && actor !== revealedSeat;
  const myTurn = online ? state.turn.activeSeat === mySeat : true;
  const waiting = online && !myTurn && owed === 0; // not your turn, nothing owed → read-only
  const interactive = !needReveal && !waiting && owed === 0;
  const placingRobber = interactive && (sub === "movingRobber" || pendingKnight);
  const robberPrompt = pendingKnight ? "Knight: Move the robber" : "Move the robber";
  const setupInstruction = interactive && sub === "setupSettlement"
    ? "Place a settlement"
    : interactive && sub === "setupRoad"
      ? "Place a road"
      : null;

  // Setup forces the build type; the main phase uses the player's selection.
  const effectiveMode: BuildMode =
    sub === "setupSettlement" ? "settlement"
    : sub === "setupRoad" ? "road"
    : buildMode;

  const legal = !interactive
    ? NO_TARGETS
    : roadEdges !== null
      ? { vertices: new Set<string>(), edges: roadEdges.length >= 2 ? new Set<string>() : legalRoadBuildingEdges(state, roadEdges), hexes: new Set<string>() }
      : sub === "movingRobber" || pendingKnight
        ? legalTargets({ ...state, turn: { ...state.turn, subPhase: "movingRobber" } }) // robber hex overlay
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
      // Tap a highlighted edge to place; tap a pending road again to remove it.
      if (roadEdges.includes(e)) setRoadEdges(roadEdges.filter((x) => x !== e));
      else if (roadEdges.length < 2) setRoadEdges([...roadEdges, e]);
      return;
    }
    if (effectiveMode !== "road") return;
    if (sub === "setupRoad") { setPendingSetup({ kind: "road", edge: e }); return; }
    if (sub === "main") { const r = await run({ type: "buildRoad", edge: e }); finishBuild(r.ok); }
  };
  const onHex = (h: string) => {
    if (!interactive || (sub !== "movingRobber" && !pendingKnight)) return;
    setPendingRobberHex(h);
    setRobberPick(null);
  };

  const playPendingKnight = async () => {
    if (!pendingKnight) return true;
    const result = await run({ type: "playKnight" });
    if (result.ok) setPendingKnight(false);
    return result.ok;
  };

  const confirmRobberPlacement = async () => {
    if (pendingRobberHex === null) return;
    const hex = pendingRobberHex;
    const victims = eligibleVictims(state, hex);
    if (!(await playPendingKnight())) return;
    if (victims.length === 0) {
      const result = await run({ type: "moveRobber", hex });
      if (result.ok) setPendingRobberHex(null);
    } else if (victims.length === 1) {
      const result = await run({ type: "moveRobber", hex, victim: victims[0]! });
      if (result.ok) setPendingRobberHex(null);
    } else {
      setRobberPick({ hex, victims });
      setPendingRobberHex(null);
    }
  };

  const onPlayDev = (type: DevCardType) => {
    // Board-targeting cards hand focus to the board: collapse the sheet.
    if (type === "knight") { setPendingKnight(true); setPendingRobberHex(null); setRobberPick(null); setSheetOpen(false); return; }
    if (type === "monopoly") return setDevModal("monopoly");
    if (type === "yearOfPlenty") return setDevModal("yearOfPlenty");
    if (type === "roadBuilding") { setRoadEdges([]); setSheetOpen(false); }
  };

  const confirmRoadBuilding = async () => {
    if (roadEdges === null || roadEdges.length < 1) return;
    const result = await run({ type: "playRoadBuilding", edges: roadEdges });
    if (result.ok) setRoadEdges(null);
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
          <strong>{robberPrompt}</strong>
          <span>Choose a highlighted hex to block production and steal from an adjacent player.</span>
        </div>
      )}
      {setupInstruction !== null && (
        <div className="setup-placement-banner" role="status" aria-label="Setup placement">
          <strong>{setupInstruction}</strong>
          <span>Choose a highlighted spot on the board.</span>
        </div>
      )}
      {roadEdges !== null && (
        <div className="dev-placement-banner" role="status" aria-label="Road building placement">
          <strong>Road Building: place 2 free roads</strong>
          <span>Tap highlighted edges to place. Tap a placed road to remove it.</span>
        </div>
      )}
      <BoardSvg state={state} legal={legal} robberPlacement={placingRobber} selectedRobberHex={pendingRobberHex}
        pendingRoads={roadEdges !== null ? { edges: roadEdges, color: state.players[state.turn.activeSeat]!.color } : null}
        onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
      {/* Fixed-height dock: its contents change with the phase, its height
          never does — the board above stays anchored. */}
      <div className="control-dock">
        {needReveal || owed > 0 ? null : waiting ? (
          <>
            <div className="waiting-banner" role="status">
              {`Waiting for ${state.players[state.turn.activeSeat]!.name}…`}
            </div>
            <SheetPeek seat={viewer} />
          </>
        ) : (
          <>
            {pendingRobberHex !== null && (sub === "movingRobber" || pendingKnight) ? (
              <div className="action-bar action-confirm" role="dialog" aria-modal="true" aria-label="Confirm robber placement">
                <p>Move the robber to this hex?</p>
                <button className="btn-primary" onClick={() => { void confirmRobberPlacement(); }}>Confirm</button>
                <button onClick={() => setPendingRobberHex(null)}>Cancel</button>
              </div>
            ) : pendingKnight ? (
              <div className="action-bar action-confirm" role="dialog" aria-modal="true" aria-label="Cancel knight">
                <p>Choose a hex for the knight, or cancel to keep the card.</p>
                <button onClick={() => { setPendingKnight(false); setPendingRobberHex(null); }}>Cancel</button>
              </div>
            ) : roadEdges !== null ? (
              <div className="action-bar action-confirm" role="dialog" aria-modal="true" aria-label="Road building">
                <p>Roads placed: {roadEdges.length}/2</p>
                <button className="btn-primary" disabled={roadEdges.length < 1}
                  onClick={() => { void confirmRoadBuilding(); }}>Confirm</button>
                <button onClick={() => setRoadEdges(null)}>Cancel</button>
              </div>
            ) : buildMode === null && <ActionBar />}
            {roadEdges === null && (
              <BuildControls buildMode={buildMode}
                onSelect={(m) => { setBuildMode(m); setSheetOpen(false); }}
                onCancel={() => setBuildMode(null)} />
            )}
            <SheetPeek seat={viewer} />
          </>
        )}
      </div>
      <div inert={needReveal || owed > 0 ? true : undefined}>
        <BottomSheet open={sheetOpen && !needReveal && owed === 0}
          onToggle={() => setSheetOpen(!sheetOpen)}
          tab={tab} onSelect={selectTab}
          height={sheetHeight} onHeightChange={changeSheetHeight}
          tabs={[
            { id: "hand", label: "Hand" },
            { id: "trades", label: tradesTabLabel(state.tradeOffers.length) },
            { id: "log", label: "Log" },
            ...(gameId !== null ? [{ id: "links" as const, label: "Links" }] : []),
          ]}>
          {tab === "hand" && (interactive ? <HandPanel onPlayDev={onPlayDev} /> : <HandPanel />)}
          {tab === "trades" && <TradePanel />}
          {tab === "log" && <LogRail />}
          {tab === "links" && gameId !== null && (rescueLinks !== null
            ? <HostLinksPanel id={gameId} links={rescueLinks} />
            : <p>Recovery links are loading…</p>)}
        </BottomSheet>
      </div>
      {needReveal && (
        <PassDeviceScreen name={state.players[actor]!.name} onReveal={() => setRevealedSeat(actor)} />
      )}
      {!needReveal && owed > 0 && (
        <DiscardModal state={state} seat={viewer} owed={owed}
          onDiscard={(cards) => run({ type: "discard", seat: viewer, cards })} />
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

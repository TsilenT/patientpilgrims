import { Fragment, useState } from "react";
import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";
import { RESOURCE_LIST, totalCards } from "../../engine/resources";
import { portRatio } from "../../engine/actions/trade";
import { RESOURCE_ICON } from "../icons";
import type { Action, GameState, Player, Resource, ResourceMap } from "../../engine/types";
import type { DispatchResult } from "../../state/store";

type RunFn = (a: Action) => Promise<DispatchResult>;
const empty = (): ResourceMap => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });

function ResIcon({ r }: { r: Resource }) {
  const Icon = RESOURCE_ICON[r];
  return <Icon className="res-icon" />;
}

/** Compact icon+count list for a resource bundle ("nothing" when empty). */
function ResList({ map }: { map: ResourceMap }) {
  const items = RESOURCE_LIST.filter((r) => map[r] > 0);
  if (items.length === 0) return <span className="res-none">nothing</span>;
  return (
    <span className="res-list">
      {items.map((r) => (
        <span key={r} className="res-mini"><ResIcon r={r} /> {map[r]}</span>
      ))}
    </span>
  );
}

function ProposeTrade({ me, run }: { me: Player; run: RunFn }) {
  const [give, setGive] = useState<ResourceMap>(empty());
  const [want, setWant] = useState<ResourceMap>(empty());
  const bump = (which: "give" | "want", r: Resource, d: number) => {
    if (which === "give") setGive((m) => ({ ...m, [r]: Math.max(0, Math.min(me.resources[r], m[r] + d)) }));
    else setWant((m) => ({ ...m, [r]: Math.max(0, m[r] + d) }));
  };
  const ready = totalCards(give) > 0 && totalCards(want) > 0;
  const propose = () => {
    run({ type: "proposeTrade", give, want });
    setGive(empty());
    setWant(empty());
  };
  return (
    <div className="propose">
      <div className="propose-grid">
        <span className="col-h">You have</span>
        <span className="col-h">Give</span>
        <span className="col-h">Want</span>
        {RESOURCE_LIST.map((r) => (
          <Fragment key={r}>
            <span className="res-own"><ResIcon r={r} /> {me.resources[r]}</span>
            <span className="stepper">
              <button data-testid={`give-sub-${r}`} disabled={give[r] <= 0} onClick={() => bump("give", r, -1)}>−</button>
              <span className="stepper-n">{give[r]}</span>
              <button data-testid={`give-add-${r}`} disabled={give[r] >= me.resources[r]} onClick={() => bump("give", r, 1)}>+</button>
            </span>
            <span className="stepper">
              <button data-testid={`want-sub-${r}`} disabled={want[r] <= 0} onClick={() => bump("want", r, -1)}>−</button>
              <span className="stepper-n">{want[r]}</span>
              <button data-testid={`want-add-${r}`} onClick={() => bump("want", r, 1)}>+</button>
            </span>
          </Fragment>
        ))}
      </div>
      <div className="trade-summary"><ResList map={give} /> <span className="arrow">→</span> <ResList map={want} /></div>
      <button className="btn-primary" disabled={!ready} onClick={propose}>Propose</button>
    </div>
  );
}

function BankTrade({ state, seat, run }: { state: GameState; seat: number; run: RunFn }) {
  const me = state.players[seat]!;
  const [giveRes, setGiveRes] = useState<Resource | null>(null);
  const [getRes, setGetRes] = useState<Resource | null>(null);
  const ratioOf = (r: Resource) => portRatio(state, seat, r);
  const ready = giveRes !== null && getRes !== null && giveRes !== getRes;
  const trade = () => {
    if (!ready) return;
    run({ type: "tradeBank", give: giveRes, get: getRes });
    setGiveRes(null);
    setGetRes(null);
  };
  return (
    <div className="bank">
      <p className="bank-h">You give</p>
      <div className="res-pick">
        {RESOURCE_LIST.map((r) => (
          <button key={r} data-testid={`bank-give-${r}`} disabled={me.resources[r] < ratioOf(r)}
            className={giveRes === r ? "picked" : undefined} aria-pressed={giveRes === r}
            title={`Trade ${ratioOf(r)} ${r} for 1`} onClick={() => setGiveRes(r)}>
            <ResIcon r={r} /><span className="ratio">×{ratioOf(r)}</span>
          </button>
        ))}
      </div>
      <p className="bank-h">You get</p>
      <div className="res-pick">
        {RESOURCE_LIST.map((r) => (
          <button key={r} data-testid={`bank-get-${r}`} disabled={r === giveRes || state.bank[r] < 1}
            className={getRes === r ? "picked" : undefined} aria-pressed={getRes === r}
            onClick={() => setGetRes(r)}>
            <ResIcon r={r} />
          </button>
        ))}
      </div>
      <button className="btn-primary" data-testid="bank-trade" disabled={!ready} onClick={trade}>
        {ready
          ? <>Trade {ratioOf(giveRes)} <ResIcon r={giveRes} /> → 1 <ResIcon r={getRes} /></>
          : "Trade with bank"}
      </button>
    </div>
  );
}

function OpenOffers({ state, mySeat, seat, run }: {
  state: GameState; mySeat: number | null; seat: number; run: RunFn;
}) {
  if (state.tradeOffers.length === 0) return null;
  return (
    <section className="open-offers" aria-label="Open offers">
      <h3>Open offers</h3>
      <ul>
        {state.tradeOffers.map((o) => {
          const acceptors = (mySeat === null ? state.players : state.players.filter((p) => p.seat === mySeat))
            .filter((p) => p.seat !== o.from && (o.to === undefined || o.to === p.seat));
          return (
            <li key={o.id} data-offer={o.id}>
              <span className="offer-desc">
                <strong>{state.players[o.from]!.name}</strong> gives <ResList map={o.give} /> for <ResList map={o.want} />
              </span>
              <span className="offer-actions">
                {o.from === seat && (
                  <button onClick={() => run({ type: "cancelTrade", offerId: o.id })}>Cancel</button>
                )}
                {acceptors.map((p) => (
                  <button key={p.seat} className="btn-primary" data-testid={`accept-${o.id}-${p.seat}`}
                    onClick={() => run({ type: "acceptTrade", offerId: o.id, seat: p.seat })}>
                    {mySeat === null ? `${p.name} accepts` : "Accept"}
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TradePanel() {
  const { state, mySeat } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const seat = mySeat ?? state.turn.activeSeat;
  const isMyTurn = mySeat === null || mySeat === state.turn.activeSeat;
  const [mode, setMode] = useState<"players" | "bank">("players");

  return (
    <div className="trade-panel">
      {isMyTurn && (
        <>
          <div className="trade-modes" role="tablist" aria-label="Trade type">
            <button role="tab" aria-selected={mode === "players"} onClick={() => setMode("players")}>Players</button>
            <button role="tab" aria-selected={mode === "bank"} onClick={() => setMode("bank")}>Bank</button>
          </div>
          {mode === "players"
            ? <ProposeTrade me={state.players[seat]!} run={run} />
            : <BankTrade state={state} seat={seat} run={run} />}
        </>
      )}
      <OpenOffers state={state} mySeat={mySeat} seat={seat} run={run} />
      {!isMyTurn && state.tradeOffers.length === 0 && <p className="trade-empty">No open offers right now.</p>}
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

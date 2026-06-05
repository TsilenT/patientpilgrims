import { useState } from "react";
import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";
import { RESOURCE_LIST } from "../../engine/resources";
import type { Resource, ResourceMap } from "../../engine/types";

const empty = (): ResourceMap => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
const summarize = (m: ResourceMap): string =>
  RESOURCE_LIST.filter((r) => m[r] > 0).map((r) => `${m[r]} ${r}`).join(", ") || "nothing";

export function TradePanel() {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const seat = state.turn.activeSeat;
  const [give, setGive] = useState<Resource>("wood");
  const [get, setGet] = useState<Resource>("brick");
  const [offerGive, setOfferGive] = useState<ResourceMap>(empty());
  const [offerWant, setOfferWant] = useState<ResourceMap>(empty());

  const bump = (which: "give" | "want", r: Resource, d: number) => {
    const setter = which === "give" ? setOfferGive : setOfferWant;
    setter((m) => ({ ...m, [r]: Math.max(0, m[r] + d) }));
  };

  return (
    <div className="trade-panel">
      <section aria-label="Bank trade">
        <h3>Bank trade</h3>
        <select aria-label="give" value={give} onChange={(e) => setGive(e.target.value as Resource)}>
          {RESOURCE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span> for </span>
        <select aria-label="receive" value={get} onChange={(e) => setGet(e.target.value as Resource)}>
          {RESOURCE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={() => run({ type: "tradeBank", give, get })}>Trade with bank</button>
      </section>

      <section aria-label="Propose trade">
        <h3>Propose a trade</h3>
        <div className="offer-give">
          <span>You give:</span>
          {RESOURCE_LIST.map((r) => (
            <span key={r} className="res-stepper">
              {r}: {offerGive[r]}
              <button data-testid={`give-sub-${r}`} onClick={() => bump("give", r, -1)}>−</button>
              <button data-testid={`give-add-${r}`} onClick={() => bump("give", r, 1)}>+</button>
            </span>
          ))}
        </div>
        <div className="offer-want">
          <span>You want:</span>
          {RESOURCE_LIST.map((r) => (
            <span key={r} className="res-stepper">
              {r}: {offerWant[r]}
              <button data-testid={`want-sub-${r}`} onClick={() => bump("want", r, -1)}>−</button>
              <button data-testid={`want-add-${r}`} onClick={() => bump("want", r, 1)}>+</button>
            </span>
          ))}
        </div>
        <button onClick={() => {
          run({ type: "proposeTrade", give: offerGive, want: offerWant });
          setOfferGive(empty()); setOfferWant(empty());
        }}>Propose</button>
      </section>

      <section aria-label="Open offers">
        <h3>Open offers</h3>
        <ul>
          {state.tradeOffers.map((o) => (
            <li key={o.id} data-offer={o.id}>
              {state.players[o.from]!.name} gives {summarize(o.give)} for {summarize(o.want)}
              {o.from === seat && (
                <button onClick={() => run({ type: "cancelTrade", offerId: o.id })}>Cancel</button>
              )}
              {state.players
                .filter((p) => p.seat !== o.from && (o.to === undefined || o.to === p.seat))
                .map((p) => (
                  <button key={p.seat} data-testid={`accept-${o.id}-${p.seat}`}
                    onClick={() => run({ type: "acceptTrade", offerId: o.id, seat: p.seat })}>
                    {p.name} accepts
                  </button>
                ))}
            </li>
          ))}
        </ul>
      </section>
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

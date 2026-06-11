import { useState } from "react";
import { useGame } from "../../state/GameProvider";
import type { LogEntry } from "../../engine/types";

/** Plays back the opening roll-off (from the log) before setup begins. */
export function OrderRollReveal() {
  const { state } = useGame();
  const [dismissed, setDismissed] = useState(false);

  const rolls = state.log.filter((e) => e.type === "orderRoll");
  if (dismissed || state.phase !== "setup" || state.setup?.pos !== 0 || rolls.length === 0) return null;

  const rounds = new Map<number, LogEntry[]>();
  for (const e of rolls) rounds.set(e.round ?? 1, [...(rounds.get(e.round ?? 1) ?? []), e]);
  const order = state.setup.order.slice(0, state.players.length);
  const first = state.players[order[0]!]!;

  let row = 0;
  return (
    <div className="order-reveal" role="dialog" aria-modal="true" aria-label="Turn order">
      <h2>Rolling for turn order</h2>
      {[...rounds.keys()].sort((a, b) => a - b).map((round) => (
        <div key={round} className="order-round">
          {round > 1 && <p className="tiebreak">Tie! Roll again…</p>}
          <ul>
            {rounds.get(round)!.map((e) => {
              const p = state.players[e.seat]!;
              return (
                <li key={`${round}-${e.seat}`} style={{ animationDelay: `${row++ * 350}ms` }}>
                  <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
                  <span className="who">{p.name}</span>
                  <span className="dice">🎲 {e.dice![0]} + {e.dice![1]} = <strong>{e.sum}</strong></span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="order-result" style={{ animationDelay: `${row * 350}ms` }}>
        <strong>{first.name} goes first!</strong>{" "}
        <span className="order-sequence">
          ({order.map((s) => state.players[s]!.name).join(" → ")})
        </span>
      </p>
      <button className="btn-primary" onClick={() => setDismissed(true)}>Begin</button>
    </div>
  );
}

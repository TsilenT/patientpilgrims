import { useState } from "react";
import type { GameState, ResourceMap } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";
import { ResTile } from "../icons";

export function DiscardModal({ state, seat, owed, onDiscard }: {
  state: GameState; seat: number; owed: number; onDiscard: (cards: ResourceMap) => void;
}) {
  const have = state.players[seat]!.resources;
  const [collapsed, setCollapsed] = useState(false);
  const [sel, setSel] = useState<ResourceMap>({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  const total = RESOURCE_LIST.reduce((s, r) => s + sel[r], 0);
  const remaining = owed - total;
  const adj = (r: keyof ResourceMap, d: number) =>
    setSel((cur) => ({ ...cur, [r]: Math.max(0, Math.min(have[r], cur[r] + d)) }));

  return (
    <div
      className={["discard-modal", collapsed ? "discard-modal--collapsed" : null].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="false"
      aria-label="Discard cards"
    >
      <div className="discard-head">
        <div>
          <strong>Discard required</strong>
          <p>{state.players[seat]!.name} must discard {owed} card{owed === 1 ? "" : "s"} before play can continue.</p>
        </div>
        <button
          type="button"
          className="discard-minimize"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "Open" : "Minimize"}
        </button>
      </div>

      <div className="discard-lock-note" role="status">
        Board view is available. Turn actions stay locked until discard is confirmed.
      </div>

      {collapsed ? (
        <div className="discard-collapsed-row">
          <span>{total}/{owed} selected</span>
          <button type="button" className="btn-primary" onClick={() => setCollapsed(false)}>
            Choose cards
          </button>
        </div>
      ) : (
        <>
          <div className="discard-progress" aria-label="Discard progress">
            <span>{total}/{owed} selected</span>
            <span>{remaining > 0 ? `${remaining} more to choose` : "Ready to discard"}</span>
          </div>
          <div className="discard-list">
            {RESOURCE_LIST.map((r) => (
              <div key={r} className="discard-row">
                <span className="discard-resource"><ResTile r={r} /> {r}</span>
                <span className="discard-count">{sel[r]}/{have[r]}</span>
                <span className="stepper">
                  <button data-testid={`discard-remove-${r}`} aria-label={`Remove ${r}`} onClick={() => adj(r, -1)}>−</button>
                  <button data-testid={`discard-add-${r}`} aria-label={`Add ${r}`} onClick={() => adj(r, 1)}>+</button>
                </span>
              </div>
            ))}
          </div>
          <button className="btn-primary discard-submit" disabled={total !== owed} onClick={() => onDiscard(sel)}>
            Confirm discard
          </button>
        </>
      )}
    </div>
  );
}

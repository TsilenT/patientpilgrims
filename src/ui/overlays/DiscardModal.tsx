import { useState } from "react";
import type { GameState, ResourceMap } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";

export function DiscardModal({ state, seat, owed, onDiscard }: {
  state: GameState; seat: number; owed: number; onDiscard: (cards: ResourceMap) => void;
}) {
  const have = state.players[seat]!.resources;
  const [sel, setSel] = useState<ResourceMap>({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  const total = RESOURCE_LIST.reduce((s, r) => s + sel[r], 0);
  const adj = (r: keyof ResourceMap, d: number) =>
    setSel((cur) => ({ ...cur, [r]: Math.max(0, Math.min(have[r], cur[r] + d)) }));
  return (
    <div className="discard-modal" role="dialog" aria-label="Discard cards">
      <p>{state.players[seat]!.name} must discard {owed} ({total}/{owed})</p>
      {RESOURCE_LIST.map((r) => (
        <div key={r} className="discard-row">
          <span>{r}: {sel[r]}/{have[r]}</span>
          <button data-testid={`discard-remove-${r}`} onClick={() => adj(r, -1)}>−</button>
          <button data-testid={`discard-add-${r}`} onClick={() => adj(r, 1)}>+</button>
        </div>
      ))}
      <button disabled={total !== owed} onClick={() => onDiscard(sel)}>Discard</button>
    </div>
  );
}

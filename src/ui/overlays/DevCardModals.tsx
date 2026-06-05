import { useState } from "react";
import type { Resource } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";

export function MonopolyPicker({ onPick, onCancel }: {
  onPick: (r: Resource) => void; onCancel: () => void;
}) {
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Monopoly">
      <p>Choose a resource to monopolize:</p>
      {RESOURCE_LIST.map((r) => (
        <button key={r} onClick={() => onPick(r)}>{r}</button>
      ))}
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function YearOfPlentyPicker({ onPick, onCancel }: {
  onPick: (rs: [Resource, Resource]) => void; onCancel: () => void;
}) {
  const [picks, setPicks] = useState<Resource[]>([]);
  const add = (r: Resource) => {
    const next = [...picks, r];
    if (next.length === 2) onPick([next[0]!, next[1]!]);
    else setPicks(next);
  };
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Year of Plenty">
      <p>Choose two resources ({picks.length}/2):</p>
      {RESOURCE_LIST.map((r) => (
        <button key={r} onClick={() => add(r)}>{r}</button>
      ))}
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

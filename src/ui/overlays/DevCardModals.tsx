import { useState } from "react";
import type { Resource } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";
import { RESOURCE_ICON } from "../icons";
import { DEV_CARD_INFO } from "../devCardInfo";

export function MonopolyPicker({ onPick, onCancel }: {
  onPick: (r: Resource) => void; onCancel: () => void;
}) {
  const info = DEV_CARD_INFO.monopoly;
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Monopoly">
      <h2>{info.icon} {info.name}</h2>
      <p>{info.description}</p>
      <div className="resource-choices">
        {RESOURCE_LIST.map((r) => (
          <button key={r} aria-label={r} onClick={() => onPick(r)}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span> {r}
          </button>
        ))}
      </div>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function YearOfPlentyPicker({ onPick, onCancel }: {
  onPick: (rs: [Resource, Resource]) => void; onCancel: () => void;
}) {
  const info = DEV_CARD_INFO.yearOfPlenty;
  const [picks, setPicks] = useState<Resource[]>([]);
  const add = (r: Resource) => {
    const next = [...picks, r];
    if (next.length === 2) onPick([next[0]!, next[1]!]);
    else setPicks(next);
  };
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Year of Plenty">
      <h2>{info.icon} {info.name}</h2>
      <p>Choose two resources ({picks.length}/2):</p>
      <div className="resource-choices">
        {RESOURCE_LIST.map((r) => (
          <button key={r} aria-label={r} onClick={() => add(r)}>
            <span aria-hidden="true">{RESOURCE_ICON[r]}</span> {r}
          </button>
        ))}
      </div>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

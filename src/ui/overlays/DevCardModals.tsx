import { useState } from "react";
import type { Resource } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";
import { RESOURCE_ICON, CoinsIcon, GiftIcon } from "../icons";
import { DEV_CARD_INFO } from "../devCardInfo";

function ResourceChoices({ onPick }: { onPick: (r: Resource) => void }) {
  return (
    <div className="resource-choices">
      {RESOURCE_LIST.map((r) => {
        const ResIcon = RESOURCE_ICON[r];
        return (
          <button key={r} aria-label={r} onClick={() => onPick(r)}>
            <ResIcon className="res-icon" /> {r}
          </button>
        );
      })}
    </div>
  );
}

export function MonopolyPicker({ onPick, onCancel }: {
  onPick: (r: Resource) => void; onCancel: () => void;
}) {
  const info = DEV_CARD_INFO.monopoly;
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Monopoly">
      <h2><CoinsIcon className="dev-modal-icon" /> {info.name}</h2>
      <p>{info.description}</p>
      <ResourceChoices onPick={onPick} />
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
      <h2><GiftIcon className="dev-modal-icon" /> {info.name}</h2>
      <p>Choose two resources ({picks.length}/2):</p>
      <ResourceChoices onPick={add} />
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

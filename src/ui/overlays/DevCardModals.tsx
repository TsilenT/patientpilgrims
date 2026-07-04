import { useState } from "react";
import type { Resource } from "../../engine/types";
import { RESOURCE_LIST } from "../../engine/resources";
import { RESOURCE_ICON, CoinsIcon, GiftIcon } from "../icons";
import { DEV_CARD_INFO } from "../devCardInfo";

function ResourceChoices({ onPick, picked, disabled = false }: {
  onPick: (r: Resource) => void;
  picked: (r: Resource) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="resource-choices">
      {RESOURCE_LIST.map((r) => {
        const ResIcon = RESOURCE_ICON[r];
        const isPicked = picked(r);
        return (
          <button key={r} aria-label={r} aria-pressed={isPicked}
            className={isPicked ? "picked" : undefined}
            disabled={disabled && !isPicked}
            onClick={() => onPick(r)}>
            <ResIcon className="res-icon" /> {r}
          </button>
        );
      })}
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, confirmDisabled }: {
  onCancel: () => void; onConfirm: () => void; confirmDisabled: boolean;
}) {
  return (
    <div className="dev-modal-actions">
      <button onClick={onCancel}>Cancel</button>
      <button className="btn-primary" disabled={confirmDisabled} onClick={onConfirm}>Confirm</button>
    </div>
  );
}

export function MonopolyPicker({ onPick, onCancel }: {
  onPick: (r: Resource) => void; onCancel: () => void;
}) {
  const info = DEV_CARD_INFO.monopoly;
  const [choice, setChoice] = useState<Resource | null>(null);
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Monopoly">
      <h2><CoinsIcon className="dev-modal-icon" /> {info.name}</h2>
      <p className="dev-modal-desc">{info.description}</p>
      <p className="dev-modal-step">Choose a resource to take from every player:</p>
      <ResourceChoices picked={(r) => choice === r}
        onPick={(r) => setChoice(choice === r ? null : r)} />
      <ModalActions onCancel={onCancel} confirmDisabled={choice === null}
        onConfirm={() => { if (choice !== null) onPick(choice); }} />
    </div>
  );
}

export function YearOfPlentyPicker({ onPick, onCancel }: {
  onPick: (rs: [Resource, Resource]) => void; onCancel: () => void;
}) {
  const info = DEV_CARD_INFO.yearOfPlenty;
  const [picks, setPicks] = useState<Resource[]>([]);
  const removeAt = (i: number) => setPicks(picks.filter((_, j) => j !== i));
  // Tap to add; once full, tapping a picked resource removes it again.
  const toggle = (r: Resource) => {
    if (picks.length < 2) setPicks([...picks, r]);
    else if (picks.lastIndexOf(r) >= 0) removeAt(picks.lastIndexOf(r));
  };
  return (
    <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Year of Plenty">
      <h2><GiftIcon className="dev-modal-icon" /> {info.name}</h2>
      <p className="dev-modal-desc">{info.description}</p>
      <p className="dev-modal-step">Choose two resources from the bank ({picks.length}/2):</p>
      <ResourceChoices picked={(r) => picks.includes(r)} onPick={toggle} disabled={picks.length >= 2} />
      <div className="dev-picks" aria-label="Selected resources">
        {[0, 1].map((i) => {
          const r = picks[i];
          if (r === undefined) return <span key={i} className="dev-pick dev-pick--empty">?</span>;
          const ResIcon = RESOURCE_ICON[r];
          return (
            <button key={i} className="dev-pick" aria-label={`Remove ${r}`} title={`Remove ${r}`}
              onClick={() => removeAt(i)}>
              <ResIcon className="res-icon" /> {r} ✕
            </button>
          );
        })}
      </div>
      <ModalActions onCancel={onCancel} confirmDisabled={picks.length !== 2}
        onConfirm={() => onPick([picks[0]!, picks[1]!])} />
    </div>
  );
}

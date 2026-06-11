import { useState } from "react";
import { useGame } from "../../state/GameProvider";
import type { SeatLink } from "../../net/types";

/**
 * Host-only: the shareable game link plus per-seat rescue links (minted at start,
 * stored on the host device). Send a player their link to move them to a new
 * device or recover a lost session.
 */
export function HostLinksModal({ id, links, onClose }: {
  id: string;
  links: SeatLink[];
  onClose: () => void;
}) {
  const { state } = useGame();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const gameUrl = `${location.origin}${location.pathname}#/g/${id}`;
  return (
    <div className="dev-modal host-links" role="dialog" aria-modal="true" aria-label="Game links">
      <h2>Game links</h2>
      <div className="host-link-row">
        <span className="who">Spectate / lobby</span>
        <button onClick={() => copy("game", gameUrl)}>{copied === "game" ? "Copied!" : "Copy"}</button>
      </div>
      <p className="host-links-hint">
        Rescue links rebind a seat to whatever device opens them — send one to a player
        who switched phones or lost their session.
      </p>
      {links.map((l) => (
        <div key={l.seat} className="host-link-row">
          <span className="who">{state.players[l.seat]?.name ?? `Seat ${l.seat + 1}`}</span>
          <button onClick={() => copy(`s${l.seat}`, l.url)}>
            {copied === `s${l.seat}` ? "Copied!" : "Copy rescue link"}
          </button>
        </div>
      ))}
      <button onClick={onClose}>Close</button>
    </div>
  );
}

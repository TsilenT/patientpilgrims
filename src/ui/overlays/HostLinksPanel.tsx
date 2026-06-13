import { useState } from "react";
import { useGame } from "../../state/GameProvider";
import type { SeatLink } from "../../net/types";

/**
 * Host-only panel (a bottom-sheet tab): the shareable game link plus per-seat
 * rescue links (minted at start, stored on the host device). Send a player their
 * link to move them to a new device or recover a lost session.
 */
export function HostLinksPanel({ id, links }: { id: string; links: SeatLink[] }) {
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
    <div className="host-links" aria-label="Game links">
      <p className="host-links-hint">
        Send a player their rescue link to move them to a new device or recover a lost session.
      </p>
      <div className="host-link-row">
        <span className="who">Spectate / lobby</span>
        <button onClick={() => copy("game", gameUrl)}>{copied === "game" ? "Copied!" : "Copy"}</button>
      </div>
      {links.map((l) => (
        <div key={l.seat} className="host-link-row">
          <span className="who">{state.players[l.seat]?.name ?? `Seat ${l.seat + 1}`}</span>
          <button onClick={() => copy(`s${l.seat}`, l.url)}>
            {copied === `s${l.seat}` ? "Copied!" : "Copy rescue link"}
          </button>
        </div>
      ))}
    </div>
  );
}

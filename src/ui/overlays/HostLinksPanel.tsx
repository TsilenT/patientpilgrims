import { useState } from "react";
import { useGame } from "../../state/GameProvider";
import type { SeatLink } from "../../net/types";

/**
 * A bottom-sheet panel with the shareable game link plus per-seat device links.
 * Opening one adds that browser to the seat without disconnecting other devices.
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
        Send a player their link to play their seat on another device. Their current devices stay connected.
      </p>
      <div className="host-link-row">
        <span className="who">Spectate / lobby</span>
        <button onClick={() => copy("game", gameUrl)}>{copied === "game" ? "Copied!" : "Copy"}</button>
      </div>
      {links.map((l) => (
        <div key={l.seat} className="host-link-row">
          <span className="who">{state.players[l.seat]?.name ?? `Seat ${l.seat + 1}`}</span>
          <button onClick={() => copy(`s${l.seat}`, l.url)}>
            {copied === `s${l.seat}` ? "Copied!" : "Copy device link"}
          </button>
        </div>
      ))}
    </div>
  );
}

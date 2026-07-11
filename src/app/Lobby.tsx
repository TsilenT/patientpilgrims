import { useEffect, useRef, useState } from "react";
import type { LobbyBackend, LobbyView } from "../net/lobby";
import { MAX_SLOTS } from "../net/lobby";
import { CrownIcon } from "../ui/icons";
import { BoardModePicker } from "./BoardModePicker";

const COLORS = ["red", "blue", "white", "orange"];
const NAME_KEY = "adultingcatan:name";

export function Lobby({ id, backend, onEnterGame }: {
  id: string;
  backend: LobbyBackend;
  onEnterGame: (id: string) => void;
}) {
  const [view, setView] = useState<LobbyView | null>(null);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
  });
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const entered = useRef(false);

  useEffect(() => backend.subscribe(setView), [backend]);

  const status = view?.meta?.status;
  useEffect(() => {
    if (status === "active" && !entered.current) {
      entered.current = true;
      onEnterGame(id);
    }
  }, [status, id, onEnterGame]);

  if (!view) return <div className="start-screen"><h1>Loading lobby…</h1></div>;
  if (!view.meta) {
    return (
      <div className="start-screen">
        <h1>Game not found</h1>
        <button onClick={() => { location.hash = "#/"; }}>Back to start</button>
      </div>
    );
  }
  if (view.meta.status === "active") return <div className="start-screen"><h1>Starting…</h1></div>;

  const { meta, roster, myUid } = view;
  const isHost = meta.host === myUid;
  const canManageLobby = true;
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => roster[i] ?? null);
  const mySlot = slots.findIndex((s) => s?.uid === myUid);
  const takenColors = new Set(slots.filter((s) => s !== null && s.uid !== myUid).map((s) => s!.color));
  const freeColors = COLORS.filter((c) => !takenColors.has(c));
  const selectedColor = color !== null && freeColors.includes(color) ? color : freeColors[0];
  const claimedCount = slots.filter(Boolean).length;
  const freeSlot = slots.findIndex((s) => s === null);

  const run = (fn: () => Promise<void>, friendly: string) => {
    setBusy(true); setError(null);
    void fn().catch(() => setError(friendly)).finally(() => setBusy(false));
  };

  // Seated players see their roster name even if this device never typed one.
  const formName = name !== "" ? name : (mySlot >= 0 ? slots[mySlot]!.name : "");

  const join = () => {
    const n = formName.trim();
    if (n === "" || selectedColor === undefined) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* non-fatal */ }
    const slot = mySlot >= 0 ? mySlot : freeSlot;
    run(() => backend.claim(slot, n, selectedColor), "That seat was just taken — try again.");
  };

  const shareUrl = `${location.origin}${location.pathname}#/g/${id}`;
  const copy = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* user dismissed the share sheet */ }
  };

  return (
    <div className="start-screen lobby">
      <h1>Game lobby</h1>
      <p className="lobby-code">Game code: <strong>{id}</strong></p>
      <button onClick={() => { void copy(); }}>{copied ? "Copied!" : "Copy invite link"}</button>

      <ul className="lobby-slots">
        {slots.map((s, i) => (
          <li key={i}>
            {s ? (
              <>
                <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                <span className="lobby-name">
                  {s.name}
                  {s.uid === meta.host && <CrownIcon className="host-crown" aria-label="host" />}
                  {s.uid === myUid && <span className="you"> (you)</span>}
                </span>
                {s.uid === myUid && (
                  <button disabled={busy} onClick={() => run(() => backend.leave(i), "Could not leave the seat.")}>
                    Leave
                  </button>
                )}
                {canManageLobby && s.uid !== myUid && (
                  <button disabled={busy} aria-label={`Remove ${s.name}`}
                    onClick={() => run(() => backend.kick(i), "Could not remove the player.")}>
                    ✕
                  </button>
                )}
              </>
            ) : (
              <span className="lobby-open">Open seat</span>
            )}
          </li>
        ))}
      </ul>

      {(mySlot >= 0 || freeSlot >= 0) && (
        <div className="lobby-join">
          <input aria-label="Your name" placeholder="Your name" maxLength={24}
            value={formName} onChange={(e) => setName(e.target.value)} />
          <div className="color-picker" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => (
              <button key={c} role="radio" aria-checked={selectedColor === c} aria-label={c}
                disabled={!freeColors.includes(c)}
                className={selectedColor === c ? "color-dot selected" : "color-dot"}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <button className="btn-primary" disabled={busy || formName.trim() === ""} onClick={join}>
            {mySlot >= 0 ? "Update seat" : "Join game"}
          </button>
        </div>
      )}

      <BoardModePicker
        value={meta.mode}
        disabled={!canManageLobby || busy}
        onChange={(mode) => run(() => backend.setMode(mode), "Could not change the board.")}
      />

      {error && <p role="alert">{error}</p>}
      <button className="btn-primary" disabled={busy || claimedCount < 3}
        onClick={() => run(() => backend.start(), "Could not start the game.")}>
        {claimedCount < 3 ? `Start game (${claimedCount}/3)` : "Start game"}
      </button>
    </div>
  );
}

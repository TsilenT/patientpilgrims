import { useEffect, useState } from "react";
import { ensureSignedIn } from "../../net/firebase";
import { getPushState, enablePush, disablePush, type PushState } from "../../net/push";
import { HostLinksPanel } from "../overlays/HostLinksPanel";
import type { SeatLink } from "../../net/types";

export function NotificationToggle() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void getPushState().then(setState); }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uid = await ensureSignedIn();
      if (state === "on") { await disablePush(uid); setState("off"); }
      else { setState(await enablePush(uid)); }
    } finally { setBusy(false); }
  };

  if (state === "loading") return <p className="settings-note">Checking notifications…</p>;
  if (state === "unsupported") {
    return <p className="settings-note">Add to Home Screen to enable notifications.</p>;
  }
  if (state === "blocked") {
    return <p className="settings-note">Notifications are blocked. Re-enable them in your browser settings.</p>;
  }
  return (
    <button className="settings-toggle" aria-pressed={state === "on"}
      disabled={busy} onClick={() => void toggle()}>
      {state === "on" ? "✓ " : ""}Notify me when it's my turn
    </button>
  );
}

export function SettingsPanel({ gameId, links }: { gameId: string; links: SeatLink[] | null }) {
  const [linksOpen, setLinksOpen] = useState(false);
  return (
    <div className="settings-panel" aria-label="Settings">
      <NotificationToggle />
      {links !== null && (
        <div className="settings-section">
          <button className="settings-section-head" aria-expanded={linksOpen}
            onClick={() => setLinksOpen((v) => !v)}>
            {linksOpen ? "⌄" : "⌃"} Host links
          </button>
          {linksOpen && <HostLinksPanel id={gameId} links={links} />}
        </div>
      )}
    </div>
  );
}

import { useEffect, useId, useState, type ReactNode } from "react";
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

  if (state === "loading") return <p className="settings-note">Checking notification support…</p>;
  if (state === "unsupported") return null;
  if (state === "blocked") {
    return <p className="settings-note">Notifications are blocked. Re-enable them in your browser settings.</p>;
  }
  return (
    <button className="settings-toggle" aria-pressed={state === "on"}
      disabled={busy} onClick={() => void toggle()}>
      <span className="settings-toggle-copy">
        <strong>Notify me when it's my turn</strong>
        <small>{state === "on" ? "Turn notifications are on" : "Turn notifications are off"}</small>
      </span>
      <span className="settings-switch" aria-hidden="true"><span /></span>
    </button>
  );
}

function SettingsAccordion({ title, summary, children, open, onToggle }: {
  title: string;
  summary: string;
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  const contentId = useId();
  return (
    <section className={`settings-accordion${open ? " open" : ""}`}>
      <button className="settings-accordion-head" aria-expanded={open} aria-controls={contentId}
        onClick={onToggle}>
        <span><strong>{title}</strong><small>{summary}</small></span>
        <span className="settings-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && <div className="settings-accordion-body" id={contentId}>{children}</div>}
    </section>
  );
}

function BasicRulebook() {
  return (
    <article className="rulebook">
      <p className="rulebook-goal"><strong>Goal:</strong> Be the first player to reach 10 victory points.</p>

      <section>
        <h3>On your turn</h3>
        <ol>
          <li><strong>Roll:</strong> Everyone with a settlement or city beside that number collects its resource. Cities collect two.</li>
          <li><strong>Trade:</strong> Exchange resources with players, the bank at 4:1, or through a port you control.</li>
          <li><strong>Build:</strong> Spend resource cards to expand, upgrade, or buy a development card.</li>
        </ol>
      </section>

      <section>
        <h3>Building costs</h3>
        <dl className="rulebook-costs">
          <div><dt>Road</dt><dd>1 brick + 1 lumber</dd></div>
          <div><dt>Settlement</dt><dd>1 brick + 1 lumber + 1 wool + 1 grain</dd></div>
          <div><dt>City</dt><dd>3 ore + 2 grain</dd></div>
          <div><dt>Development card</dt><dd>1 ore + 1 wool + 1 grain</dd></div>
        </dl>
      </section>

      <section>
        <h3>Important rules</h3>
        <ul>
          <li>Settlements must connect to your road and cannot be adjacent to another settlement or city.</li>
          <li>Roll a 7: players with more than seven resource cards discard half, then the roller moves the robber and may steal one card.</li>
          <li>The robber blocks production on its hex until it moves.</li>
        </ul>
      </section>

      <section>
        <h3>Victory points</h3>
        <p>Settlements are worth 1 point and cities 2. Longest Road and Largest Army are worth 2 each. Some development cards provide a hidden point.</p>
      </section>
    </article>
  );
}

export function SettingsPanel({ gameId, links }: { gameId: string; links: SeatLink[] | null }) {
  const [openSection, setOpenSection] = useState<"rules" | "links" | null>(null);
  const toggle = (section: "rules" | "links") => {
    setOpenSection((current) => current === section ? null : section);
  };

  return (
    <div className="settings-panel" aria-label="Settings">
      <header className="settings-header">
        <h2>Game settings</h2>
        <p>Manage this device and find help with the game.</p>
      </header>

      <section className="settings-card" aria-labelledby="notification-heading">
        <div className="settings-card-heading">
          <h3 id="notification-heading">Notifications</h3>
          <p>Keep up with the game when this tab is closed.</p>
        </div>
        <NotificationToggle />
      </section>

      <SettingsAccordion title="How to play" summary="A quick game rulebook"
        open={openSection === "rules"} onToggle={() => toggle("rules")}>
        <BasicRulebook />
      </SettingsAccordion>

      {links !== null && (
        <SettingsAccordion title="Device links" summary="Connect another device to a player seat"
          open={openSection === "links"} onToggle={() => toggle("links")}>
          <HostLinksPanel id={gameId} links={links} />
        </SettingsAccordion>
      )}
    </div>
  );
}

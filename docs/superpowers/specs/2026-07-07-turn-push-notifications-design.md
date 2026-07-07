# Turn-start push notifications — design

**Date:** 2026-07-07
**Status:** Approved (brainstorming)

## Goal

Notify a player on their phone or desktop when the game turn advances to
them, even when the app is closed. Scope is intentionally narrow: **"your
turn starts"** is the only trigger.

## Constraints & platform limitations

Baked into the design, not open questions:

- **Real push needs a server-side sender.** A notification that arrives
  when the app is closed must be sent by something running server-side; a
  static GitHub Pages site cannot, and the sending secret cannot live on
  the client. The turn-change event lives in RTDB, so a small **sender
  process** watches RTDB and sends.
- **Hosting the sender: the user's desktop, for now.** A Node script on
  the user's machine. Consequence: **pushes only send while that script
  runs.** The game turn still advances normally; players just aren't
  pinged while the sender is down. Clean to relocate to a hosted function
  later.
- **Transport: Web Push (VAPID), not FCM.** No Google Cloud, no Blaze
  plan. Works on Android, desktop, and installed iPhones alike.
- **Per-platform:**
  - Android (Chrome): full support, browser tab or installed PWA.
  - Desktop (Chrome/Edge/Firefox, macOS Safari 16.1+): full support.
  - iPhone (Safari): works **only** when the PWA is installed via Add to
    Home Screen (iOS 16.4+). Never works in a plain Safari tab — Apple's
    rule. On a non-installed iPhone `PushManager` is absent.
- Permission must be requested from a user gesture (a tap).
- Delivery is best-effort; a sleeping/offline device may delay.
- Anonymous auth: the subscription is tied to the browser instance;
  clearing site data loses it.

## Architecture

Three pieces:

1. **Service worker** — receives the push and shows the notification even
   when the app is closed.
2. **Client subscribe flow** — asks permission, subscribes, saves the
   subscription to RTDB under the player's uid.
3. **Desktop sender** — a Node script that watches turn changes and sends
   the push to the next player.

### Existing data model this hooks into

- `games/{id}/state` holds `GameState`; the active player is
  `state.turn.activeSeat` (a seat index), cycling through
  `state.turnOrder`.
- `games/{id}/seats/{seat}` = `{ uid, proof }` maps a seat to a browser
  uid.
- Turn advance = `turn.activeSeat` changes (see
  `src/engine/actions/turn.ts` `applyEndTurn`).

## Components

### 1. Service worker — `public/sw.js`

Kept tiny (hard to unit-test; keep logic minimal).

- `push` event → `showNotification("Your turn", { body, tag, data:{url} })`.
  `tag` per game so repeated pings coalesce.
- `notificationclick` → focus an existing client tab if open, else
  `clients.openWindow(gameUrl)`.
- Registered at the app base path so its scope covers the game under the
  `/adultingcatan/` (and `stevets.ai`) subpath. Registration uses a
  relative URL so it works under any base.

### 2. Client — `src/net/push.ts` + a UI toggle

`src/net/push.ts` exposes a small state machine:

- `getPushState(): "unsupported" | "off" | "on" | "blocked"`
  - `unsupported` when `serviceWorker`/`PushManager`/`Notification` absent
    (covers non-installed iPhone).
- `enablePush()`:
  1. register the service worker,
  2. `Notification.requestPermission()` (must be called from a tap),
  3. `registration.pushManager.subscribe({ userVisibleOnly: true,
     applicationServerKey: urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY) })`,
  4. write `{ subscription, updatedAt }` to `/pushSubs/{uid}`.
- `disablePush()`: unsubscribe + remove `/pushSubs/{uid}`.
- **Startup re-sync:** on app load, if permission is already granted, read
  the current `PushManager` subscription and re-write `/pushSubs/{uid}`
  (last-write-wins). The uid is stable across refreshes, so this heals a
  rotated push endpoint the moment the app opens, before any send fails.
  When the uid genuinely changes (cleared data / new device), the old
  session is gone; correctness then comes from the seat→uid indirection
  below, not from the old session updating anything.

UI: a **"Notify me when it's my turn"** toggle living in a new **Settings**
tab (see "Settings tab restructure" below). Reflects the four states. On
`unsupported` specifically on iOS, show **"Add to Home Screen to enable
notifications."** On `blocked`, explain the user must re-enable in browser
settings (don't re-prompt).

### Settings tab restructure

The bottom-sheet's host-only **Links** tab becomes a **Settings** tab,
because the notification toggle must reach every player, not just the host.

- **Tab:** rename `links` → `settings` in `BottomSheet.tsx` / `GameView.tsx`.
  The tab is shown to **all players** in a networked game (previously it
  effectively only mattered to the host).
- **Contents, top to bottom:**
  1. **Notifications** — the "Notify me when it's my turn" toggle. Shown to
     everyone.
  2. **Host links** — the existing `HostLinksPanel` content, moved into a
     **collapsible section** (expand/collapse), rendered **only** for the
     host (when `rescueLinks` are present). Non-hosts don't see it.
- `HostLinksPanel` is reused as the body of the collapsible section; no
  change to its link-copying logic.

VAPID **public** key reaches the client via a new
`VITE_VAPID_PUBLIC_KEY` env var, read alongside the existing Firebase
config.

### 3. Desktop sender — `tools/push-sender/`

Standalone (own `package.json`), not part of the web build.

- Deps: `firebase-admin` (RTDB listener, bypasses security rules) +
  `web-push` (sends VAPID push, holds the private key).
- Watches each active game's `state/turn/activeSeat`. On change:
  1. resolve new `activeSeat` → uid via `/games/{id}/seats/{seat}`,
  2. resolve uid → subscription via `/pushSubs/{uid}`,
  3. `webpush.sendNotification(subscription, payload)` where payload names
     the game.
- **Resolution is at send time:** the sender always follows
  seat → *current* uid → subscription when the turn changes. A player who
  moved devices (new uid, re-claimed seat via rescue link) is reached
  correctly; the old uid's `/pushSubs` entry is an orphan no seat points
  to, never sent to, and left in place (YAGNI — TTL later if it matters).
- **Dedup:** track the last-notified seat per game in memory; skip if
  unchanged (so reconnects / initial snapshot don't re-fire).
- **Expiry:** on 404/410 from the push service, delete `/pushSubs/{uid}`.
- **Secrets:** service-account JSON + VAPID private key via env /
  gitignored file. Never committed. `.env.example` documents the vars.

The core "turn changed → who to notify" logic is a **pure function**
(inputs: previous seat, new game state, seats map, subs map → output: a
list of `{ subscription, payload }` to send). This keeps it testable
without live Firebase/web-push.

### 4. RTDB rules — `database.rules.json`

Add `/pushSubs/{uid}`:

- read/write allowed only when `auth.uid === $uid`.
- The sender uses the Admin SDK and is unaffected by rules.

## Error handling

| Situation | Behavior |
|---|---|
| Permission denied / blocked | UI shows `blocked`; never auto-reprompt. |
| `PushManager` absent (non-installed iPhone) | UI shows `unsupported` + Add-to-Home-Screen hint. |
| Subscription expired (404/410 at send) | Sender deletes `/pushSubs/{uid}`. |
| Sender process offline | No pushes sent; game unaffected. Acceptable. |
| No subscription for the next player | Sender skips silently. |

## Testing

- **Unit (client):** subscribe/permission state machine with mocked
  `Notification` / `serviceWorker` / `PushManager`.
- **Unit (sender):** the pure "turn changed → recipients" function with
  fixture game state, seats, and subs — including dedup and the
  no-subscription path.
- **Manual E2E:** two browsers, enable on both, end a turn, confirm the
  notification lands. Push delivery cannot be faked — synthetic events do
  not exercise the real push service.

## Out of scope (YAGNI)

- Trade-offer / robber / invite notifications (turn-start only).
- FCM, Blaze plan, 24/7 hosted sender (documented as an easy later move).
- Notification preferences beyond a single on/off toggle.

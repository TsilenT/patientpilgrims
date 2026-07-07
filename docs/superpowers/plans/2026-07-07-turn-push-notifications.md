# Turn-start Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify a player (Android / desktop / installed iPhone) when the game turn advances to them, even when the app is closed.

**Architecture:** Web Push (VAPID) — no FCM, no Blaze plan. A service worker shows the notification; a client flow subscribes and stores the subscription at `/pushSubs/{uid}`; a Node "sender" script on the user's desktop watches `games/{id}/state/turn/activeSeat` via the Firebase Admin SDK and sends the push to the next player. Subscriptions are keyed by the stable anonymous-auth uid; the sender resolves seat → uid → subscription at send time.

**Tech Stack:** React 19 + Vite, Firebase Realtime Database + anonymous Auth, `web-push` + `firebase-admin` (sender), Vitest (app tests) + `node:test` (sender tests).

**Spec:** `docs/superpowers/specs/2026-07-07-turn-push-notifications-design.md`

---

## File Structure

**Create:**
- `public/sw.js` — service worker: `push` + `notificationclick`.
- `src/net/pushSubs.ts` — thin RTDB I/O for `/pushSubs/{uid}`.
- `src/net/push.ts` — browser push logic (support check, state, enable/disable/resync).
- `src/ui/panels/SettingsPanel.tsx` — Settings tab body: notification toggle + collapsible host links.
- `tools/push-sender/package.json`, `tools/push-sender/recipients.mjs`, `tools/push-sender/recipients.test.mjs`, `tools/push-sender/index.mjs`, `tools/push-sender/.env.example`, `tools/push-sender/README.md`.
- `tests/net/pushSubs.rules.emulator.test.ts` — RTDB rule for `/pushSubs`.
- `tests/ui/notificationToggle.test.tsx` — toggle behavior.
- `tests/net/push.test.ts` — pure helpers + state machine (jsdom, no emulator).

**Modify:**
- `database.rules.json` — add `pushSubs` rule.
- `src/net/config.ts` — add `readVapidPublicKey()`.
- `.env.example` — add `VITE_VAPID_PUBLIC_KEY`.
- `.gitignore` — ignore sender secrets.
- `src/main.tsx` — register SW + startup resync.
- `src/ui/panels/BottomSheet.tsx` — `SheetTab`: `"links"` → `"settings"`.
- `src/ui/GameView.tsx` — rename tab, render `SettingsPanel`.

> **Test-path note:** the default Vitest config includes `tests/**/*.test.ts` but **excludes `tests/net/**`** (those are emulator-only suites). The push helper tests need no emulator, so they live at **`tests/push.test.ts`** (normal suite). Only the RTDB rule test, which needs the emulator, goes under `tests/net/`.

---

## Task 1: RTDB rule for `/pushSubs/{uid}`

**Files:**
- Modify: `database.rules.json`
- Test: `tests/net/pushSubs.rules.emulator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/net/pushSubs.rules.emulator.test.ts`:

```ts
import { describe, it, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, remove } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

const sub = { subscription: { endpoint: "https://example.com/x", keys: { p256dh: "a", auth: "b" } }, updatedAt: 1 };

describe("pushSubs rules", () => {
  it("lets a user write, read, and remove only their own subscription", async () => {
    const alice = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(alice, "pushSubs/alice"), sub));
    await assertSucceeds(get(ref(alice, "pushSubs/alice")));
    await assertSucceeds(remove(ref(alice, "pushSubs/alice")));
  });

  it("denies writing or reading another user's subscription", async () => {
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "pushSubs/alice"), sub));
    await assertFails(get(ref(bob, "pushSubs/alice")));
  });

  it("denies unauthenticated access", async () => {
    const anon = env.unauthenticatedContext().database();
    await assertFails(set(ref(anon, "pushSubs/alice"), sub));
    await assertFails(get(ref(anon, "pushSubs/alice")));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:emulator -- pushSubs.rules`
Expected: FAIL — writes/reads that should succeed are denied (rule missing → default deny).

- [ ] **Step 3: Add the rule**

In `database.rules.json`, add a `pushSubs` key as a **sibling of `games`** inside `rules`:

```json
    "pushSubs": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:emulator -- pushSubs.rules`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add database.rules.json tests/net/pushSubs.rules.emulator.test.ts
git commit -m "feat(push): RTDB rule for per-user push subscriptions"
```

---

## Task 2: VAPID public-key config

**Files:**
- Modify: `src/net/config.ts`, `.env.example`
- Test: `tests/push.test.ts` (created here, extended in Task 4)

- [ ] **Step 1: Write the failing test**

Create `tests/push.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readVapidPublicKey } from "../src/net/config";

describe("readVapidPublicKey", () => {
  it("returns null when the env var is absent", () => {
    // No VITE_VAPID_PUBLIC_KEY is set in the test env.
    expect(readVapidPublicKey()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/push.test.ts`
Expected: FAIL — `readVapidPublicKey` is not exported.

- [ ] **Step 3: Implement**

In `src/net/config.ts`, append:

```ts
/** VAPID public key for Web Push. Null when not configured (→ push disabled). */
export function readVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  return key && key.length > 0 ? key : null;
}
```

In `.env.example`, append:

```
# Web Push (VAPID) public key — public, safe to ship. Generate the pair with
# `npx web-push generate-vapid-keys`; the private key stays in tools/push-sender/.env.
VITE_VAPID_PUBLIC_KEY=
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/push.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/net/config.ts .env.example tests/push.test.ts
git commit -m "feat(push): read VAPID public key from env"
```

---

## Task 3: Service worker

**Files:**
- Create: `public/sw.js`

No unit test — the SW runs only in a real browser and is deliberately tiny. Verified manually in Task 9's end-to-end check.

- [ ] **Step 1: Write the service worker**

Create `public/sw.js`:

```js
// Web Push service worker. Kept intentionally minimal.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "Your turn";
  const body = data.body || "It's your turn in Patient Pilgrims.";
  const url = data.url || "./";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: url, // coalesce repeated pings for the same game
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
```

- [ ] **Step 2: Verify it is served at the app base**

Run: `npm run build && ls dist/sw.js`
Expected: `dist/sw.js` exists (Vite copies `public/` to the build root, so it is served at `<base>/sw.js`).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(push): service worker for push + notificationclick"
```

---

## Task 4: Client push helpers + state machine

**Files:**
- Create: `src/net/pushSubs.ts`
- Create: `src/net/push.ts`
- Test: `tests/push.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/push.test.ts`:

```ts
import { urlBase64ToUint8Array, pushSupported } from "../src/net/push";

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url VAPID key to bytes", () => {
    // "BQ" (base64url) → single byte 0x05.
    const bytes = urlBase64ToUint8Array("BQ");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x05);
  });

  it("handles missing padding and url-safe chars without throwing", () => {
    expect(() => urlBase64ToUint8Array("a-b_c")).not.toThrow();
  });
});

describe("pushSupported", () => {
  it("is false when Push APIs are absent (node/jsdom default)", () => {
    expect(pushSupported()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/push.test.ts`
Expected: FAIL — `src/net/push.ts` does not exist.

- [ ] **Step 3: Implement the RTDB I/O layer**

Create `src/net/pushSubs.ts`:

```ts
import { ref, set, remove } from "firebase/database";
import { database } from "./firebase";

/** Store this browser's push subscription under its uid (last-write-wins). */
export function savePushSub(uid: string, subscription: PushSubscriptionJSON): Promise<void> {
  return set(ref(database(), `pushSubs/${uid}`), { subscription, updatedAt: Date.now() });
}

/** Remove this browser's stored subscription. */
export function removePushSub(uid: string): Promise<void> {
  return remove(ref(database(), `pushSubs/${uid}`));
}
```

- [ ] **Step 4: Implement the push module**

Create `src/net/push.ts`:

```ts
import { readVapidPublicKey } from "./config";
import { savePushSub, removePushSub } from "./pushSubs";

export type PushState = "unsupported" | "off" | "on" | "blocked";

/** True only when this browser can do Web Push (absent on non-installed iOS). */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window &&
    readVapidPublicKey() !== null
  );
}

/** Decode a base64url VAPID key into the Uint8Array applicationServerKey wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Current push state for this browser (reads permission + existing subscription). */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
}

/** Ask permission, subscribe, and persist. Must be called from a user gesture. */
export async function enablePush(uid: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(readVapidPublicKey()!),
  });
  await savePushSub(uid, sub.toJSON());
  return "on";
}

/** Unsubscribe locally and delete the stored subscription. */
export async function disablePush(uid: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sub.unsubscribe();
  await removePushSub(uid);
}

/** On app startup: if already granted, re-write the current subscription so a
 *  rotated endpoint is picked up before any send fails. No-op otherwise. */
export async function resyncPush(uid: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await savePushSub(uid, sub.toJSON());
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/push.test.ts`
Expected: PASS (all `push.test.ts` cases).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/net/push.ts src/net/pushSubs.ts tests/push.test.ts
git commit -m "feat(push): client subscribe/disable/resync helpers"
```

---

## Task 5: Notification toggle component

**Files:**
- Create: `src/ui/panels/SettingsPanel.tsx` (toggle only for now; host links added in Task 6)
- Test: `tests/ui/notificationToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/notificationToggle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../src/net/push", () => ({
  getPushState: vi.fn(async () => "off"),
  enablePush: vi.fn(async () => "on"),
  disablePush: vi.fn(async () => {}),
}));
vi.mock("../../src/net/firebase", () => ({ ensureSignedIn: vi.fn(async () => "uid-1") }));

import { NotificationToggle } from "../../src/ui/panels/SettingsPanel";
import { getPushState, enablePush } from "../../src/net/push";

beforeEach(() => { vi.clearAllMocks(); (getPushState as any).mockResolvedValue("off"); });

describe("NotificationToggle", () => {
  it("enables push when toggled on", async () => {
    render(<NotificationToggle />);
    const btn = await screen.findByRole("button", { name: /notify me when it's my turn/i });
    await userEvent.click(btn);
    await waitFor(() => expect(enablePush).toHaveBeenCalledWith("uid-1"));
  });

  it("shows the install hint when unsupported", async () => {
    (getPushState as any).mockResolvedValue("unsupported");
    render(<NotificationToggle />);
    expect(await screen.findByText(/add to home screen/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ui/notificationToggle.test.tsx`
Expected: FAIL — `NotificationToggle` not exported.

- [ ] **Step 3: Implement**

Create `src/ui/panels/SettingsPanel.tsx`:

```tsx
import { useEffect, useState } from "react";
import { ensureSignedIn } from "../../net/firebase";
import { getPushState, enablePush, disablePush, type PushState } from "../../net/push";

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
    <button className="settings-toggle" role="switch" aria-checked={state === "on"}
      disabled={busy} onClick={() => void toggle()}>
      {state === "on" ? "✓ " : ""}Notify me when it's my turn
    </button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/ui/notificationToggle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/SettingsPanel.tsx tests/ui/notificationToggle.test.tsx
git commit -m "feat(push): notification toggle component"
```

---

## Task 6: Settings tab — rename Links, add collapsible host links

**Files:**
- Modify: `src/ui/panels/BottomSheet.tsx`
- Modify: `src/ui/panels/SettingsPanel.tsx`
- Modify: `src/ui/GameView.tsx`

No new automated test (wiring + presentational). Verified via `npm run build` and the Task 9 manual check.

- [ ] **Step 1: Rename the tab id in the type**

In `src/ui/panels/BottomSheet.tsx`, change:

```ts
export type SheetTab = "hand" | "trades" | "log" | "links";
```

to:

```ts
export type SheetTab = "hand" | "trades" | "log" | "settings";
```

- [ ] **Step 2: Add the collapsible host-links section to SettingsPanel**

In `src/ui/panels/SettingsPanel.tsx`, add imports at the top:

```tsx
import { HostLinksPanel } from "../overlays/HostLinksPanel";
import type { SeatLink } from "../../net/types";
```

Add the exported panel below `NotificationToggle`:

```tsx
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
```

- [ ] **Step 3: Wire it into GameView**

In `src/ui/GameView.tsx`:

Replace the import of `HostLinksPanel` (line ~21) with:

```tsx
import { SettingsPanel } from "./panels/SettingsPanel";
```

In the `tabs={[...]}` array, replace the links entry:

```tsx
          ...(gameId !== null ? [{ id: "settings" as const, label: "Settings" }] : []),
```

Replace the links content block:

```tsx
        {tab === "settings" && gameId !== null && (
          <SettingsPanel gameId={gameId} links={rescueLinks} />
        )}
```

- [ ] **Step 4: Verify build + existing tests**

Run: `npm run typecheck && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/BottomSheet.tsx src/ui/panels/SettingsPanel.tsx src/ui/GameView.tsx
git commit -m "feat(push): Settings tab hosting the toggle + collapsible host links"
```

---

## Task 7: Register service worker + startup resync

**Files:**
- Modify: `src/main.tsx`

No automated test — startup side effect verified in the Task 9 manual check.

- [ ] **Step 1: Add registration + resync**

In `src/main.tsx`, add imports near the top (with the other imports):

```tsx
import { isFirebaseConfigured, ensureSignedIn } from "./net/firebase";
import { resyncPush } from "./net/push";
```

At the end of the file, after the `createRoot(...).render(...)` call, append:

```tsx
// Register the push service worker and, if the user already granted
// notifications, re-sync this browser's subscription (uid is stable across
// refreshes, so this heals a rotated push endpoint on load).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => {
        if (!isFirebaseConfigured()) return;
        return ensureSignedIn().then((uid) => resyncPush(uid));
      })
      .catch(() => { /* push is best-effort; ignore registration failures */ });
  });
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(push): register service worker and resync subscription on load"
```

---

## Task 8: Sender — pure recipient resolver

**Files:**
- Create: `tools/push-sender/package.json`
- Create: `tools/push-sender/recipients.mjs`
- Test: `tools/push-sender/recipients.test.mjs`

- [ ] **Step 1: Create the sender package manifest**

Create `tools/push-sender/package.json`:

```json
{
  "name": "push-sender",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "firebase-admin": "^13.0.1",
    "web-push": "^3.6.7"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tools/push-sender/recipients.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNotification } from "./recipients.mjs";

const seats = { 0: { uid: "alice" }, 1: { uid: "bob" } };
const subs = { bob: { subscription: { endpoint: "https://x/bob" } } };

test("returns a send for the new active seat's subscribed player", () => {
  const out = nextNotification({ gameId: "g1", gameName: "Game", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.equal(out.uid, "bob");
  assert.equal(out.subscription.endpoint, "https://x/bob");
  assert.match(out.payload.body, /your turn/i);
  assert.equal(out.payload.url, "#/g/g1");
});

test("dedups when the active seat is unchanged", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 1, seats, subs }), null);
});

test("returns null when the seat has no uid", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 5, lastNotifiedSeat: 0, seats, subs }), null);
});

test("returns null when the player has no subscription", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 0, lastNotifiedSeat: 1, seats, subs }), null);
});

test("falls back to the app name when gameName is missing", () => {
  const out = nextNotification({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.match(out.payload.body, /Patient Pilgrims/);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd tools/push-sender && node --test`
Expected: FAIL — `recipients.mjs` not found.

- [ ] **Step 4: Implement**

Create `tools/push-sender/recipients.mjs`:

```js
/**
 * Pure resolver: given a turn change, decide who (if anyone) to notify.
 * @returns {{ uid: string, subscription: object, payload: object } | null}
 */
export function nextNotification({ gameId, gameName, activeSeat, lastNotifiedSeat, seats, subs }) {
  if (activeSeat === null || activeSeat === undefined) return null;
  if (activeSeat === lastNotifiedSeat) return null;
  const uid = seats?.[activeSeat]?.uid;
  if (!uid) return null;
  const entry = subs?.[uid];
  if (!entry?.subscription) return null;
  return {
    uid,
    subscription: entry.subscription,
    payload: {
      title: "Your turn",
      body: `It's your turn in ${gameName || "Patient Pilgrims"}.`,
      url: `#/g/${gameId}`,
    },
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd tools/push-sender && node --test`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add tools/push-sender/package.json tools/push-sender/recipients.mjs tools/push-sender/recipients.test.mjs
git commit -m "feat(push): sender recipient resolver"
```

---

## Task 9: Sender runtime + secrets handling + docs

**Files:**
- Create: `tools/push-sender/index.mjs`
- Create: `tools/push-sender/.env.example`
- Create: `tools/push-sender/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Ignore sender secrets**

In `.gitignore`, under the `# Local env / secrets` section, add:

```
tools/push-sender/service-account.json
```

(`.env` and `node_modules/` are already ignored globally.)

- [ ] **Step 2: Document the environment**

Create `tools/push-sender/.env.example`:

```
# Firebase Admin service account (Project settings → Service accounts → Generate key).
# Save the JSON to tools/push-sender/service-account.json (gitignored).
SERVICE_ACCOUNT_PATH=./service-account.json
DATABASE_URL=https://YOUR-PROJECT-default-rtdb.firebaseio.com

# VAPID keys — generate once with `npx web-push generate-vapid-keys`.
# The PUBLIC key must also be set as VITE_VAPID_PUBLIC_KEY in the web app.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

- [ ] **Step 3: Implement the runtime**

Create `tools/push-sender/index.mjs`:

```js
import "dotenv/config";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import webpush from "web-push";
import { nextNotification } from "./recipients.mjs";

const serviceAccount = JSON.parse(readFileSync(process.env.SERVICE_ACCOUNT_PATH, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const db = admin.database();
const lastNotified = new Map(); // gameId -> last seen activeSeat

db.ref("games").on("child_added", (snap) => watchGame(snap.key));
db.ref("games").on("child_removed", (snap) => lastNotified.delete(snap.key));

function watchGame(gameId) {
  db.ref(`games/${gameId}/state/turn/activeSeat`).on("value", async (snap) => {
    const activeSeat = snap.val();
    const last = lastNotified.get(gameId);
    lastNotified.set(gameId, activeSeat);
    // First observation only seeds state — don't notify for a turn already in progress.
    if (last === undefined || activeSeat === last) return;
    await maybeSend(gameId, activeSeat, last);
  });
}

async function maybeSend(gameId, activeSeat, lastSeat) {
  const [seatsSnap, metaSnap] = await Promise.all([
    db.ref(`games/${gameId}/seats`).get(),
    db.ref(`games/${gameId}/meta`).get(),
  ]);
  const seats = seatsSnap.val() || {};
  const uid = seats?.[activeSeat]?.uid;
  if (!uid) return;
  const subSnap = await db.ref(`pushSubs/${uid}`).get();
  const send = nextNotification({
    gameId,
    gameName: metaSnap.val()?.name,
    activeSeat,
    lastNotifiedSeat: lastSeat,
    seats,
    subs: { [uid]: subSnap.val() },
  });
  if (!send) return;
  try {
    await webpush.sendNotification(send.subscription, JSON.stringify(send.payload));
    console.log(`sent turn ping → game ${gameId}, seat ${activeSeat}`);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await db.ref(`pushSubs/${uid}`).remove();
      console.log(`removed expired subscription for ${uid}`);
    } else {
      console.error(`send failed (${err.statusCode})`, err.body || err.message);
    }
  }
}

console.log("push-sender running — watching for turn changes");
```

- [ ] **Step 4: Write the README**

Create `tools/push-sender/README.md`:

```markdown
# push-sender

Sends a Web Push notification to the next player when the game turn advances.
Runs on your desktop; pushes only go out while this process is running.

## Setup

1. `cd tools/push-sender && npm install`
2. Firebase console → Project settings → Service accounts → **Generate new private key**.
   Save it as `tools/push-sender/service-account.json`.
3. Generate VAPID keys: `npx web-push generate-vapid-keys`
4. `cp .env.example .env` and fill in `DATABASE_URL` and the VAPID keys.
5. Put the **public** VAPID key in the web app's env as `VITE_VAPID_PUBLIC_KEY` and redeploy.

## Run

```
npm start
```

## Limitations

- Notifications only send while this process runs (laptop closed → no pings; the
  game turn still advances normally).
- iPhone recipients must install the PWA via **Add to Home Screen** (iOS 16.4+);
  Web Push never works in a plain iOS Safari tab.
- Delivery is best-effort; a sleeping/offline device may delay a notification.
```

- [ ] **Step 5: Verify the sender starts and fails cleanly without config**

Run: `cd tools/push-sender && npm install && node --test`
Expected: install succeeds; `node --test` PASS (recipient tests). (A full live run needs real credentials — that is the manual check below.)

- [ ] **Step 6: Manual end-to-end check**

1. Deploy the web app with `VITE_VAPID_PUBLIC_KEY` set.
2. On two devices/browsers, open a game, go to **Settings → Notify me when it's my turn**, grant permission.
3. Start the sender: `cd tools/push-sender && npm start`.
4. End a turn so play passes to the other player.
5. Confirm the other device shows a "Your turn" notification; tapping it focuses/opens the game.

- [ ] **Step 7: Commit**

```bash
git add tools/push-sender/index.mjs tools/push-sender/.env.example tools/push-sender/README.md .gitignore
git commit -m "feat(push): desktop sender runtime + setup docs"
```

---

## Self-Review Notes

- **Spec coverage:** service worker (T3), client subscribe/state/resync (T4), toggle + Settings-tab restructure with collapsible host links (T5–T6), startup registration + resync (T7), RTDB rule (T1), VAPID config (T2), desktop sender with seat→uid resolution + dedup + expiry cleanup (T8–T9), limitations documented in the sender README. All spec sections mapped.
- **Type consistency:** `PushState` (`unsupported`/`off`/`on`/`blocked`) is defined in `src/net/push.ts` and consumed in `SettingsPanel.tsx`. `savePushSub`/`removePushSub` names match between `pushSubs.ts` and `push.ts`. `nextNotification` signature is identical across `recipients.mjs`, its test, and `index.mjs`. `SheetTab` value `"settings"` is used consistently in `BottomSheet.tsx` and `GameView.tsx`.
- **Out of scope (per spec):** no FCM/Blaze, no 24/7 hosting, turn-start only.
```

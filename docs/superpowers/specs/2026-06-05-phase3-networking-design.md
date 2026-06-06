# Phase 3 — Networking, Lobby & Deployment — Design Spec

**Date:** 2026-06-05
**Status:** Approved (pre-implementation)
**Parent spec:** [2026-06-03-catan-async-design.md](2026-06-03-catan-async-design.md)

Turns the local hotseat game (Phases 1–2) into an async, multi-device game hosted on
GitHub Pages, backed by Firebase Realtime Database. The rules engine and UI stay
Firebase-unaware; networking is isolated behind a single seam.

---

## 1. Goals & constraints

- **Multi-device async play.** Friends open a per-seat secret link on any device, take
  their turn, and leave. No real-time presence required.
- **Static hosting.** Deployable to GitHub Pages via GitHub Actions. No backend server.
- **Keep hotseat.** The existing single-device pass-and-play mode remains available
  alongside online games.
- **Trust-the-friends security.** Anonymous auth + version-checked writes + active-seat
  write enforcement. Prevents casual impersonation and lost-update races; a friend hacking
  their own client is explicitly out of scope (parent spec §5).
- **Graceful degradation.** With no Firebase config present, the app still runs
  hotseat-only — local dev and tests never require Firebase.

### Non-goals (YAGNI)

Real-time presence, in-app chat, turn-notification push (Discord etc.), accounts/profiles,
spectator mode, per-seat encryption of hidden information (accepted trade-off, parent spec
§5). Custom domain (default project URL only).

---

## 2. Key decisions

| Decision | Choice |
|---|---|
| Backend | Firebase Realtime Database (per parent spec) |
| Identity | Anonymous auth; secret claim-link per seat |
| Modes | Online async **and** local hotseat both selectable |
| Net/UI seam | `NetworkedGameStore` mirrors `GameStore`'s `{getState, subscribe, dispatch}` |
| Concurrency | Firebase transaction on `/games/{id}/state`, version-checked |
| Hosting | GitHub Pages, **default project URL** `username.github.io/adultingcatan/` |
| Security rules | Spec-level: auth + strict `version+1` + active-seat write (with discard/trade exceptions) |
| Routing | Hash router (no server rewrites needed on Pages) |

---

## 3. Architecture: the store seam

The UI depends on `GameStore` through exactly three members — `getState`, `subscribe`,
`dispatch` — consumed by `GameProvider`/`useGame`. Phase 3 introduces a sibling with the
**same shape**, so no UI component, provider, or hook changes.

```
App / Lobby (React)     hash routing · create game · claim seat · mode select
UI / View (React+SVG)   render state · capture intent          ← unchanged
Store seam              GameStore (hotseat) │ NetworkedGameStore (online)
Net adapter (net/)      Firebase init · anon auth · subscribe · commitAction txn
Rules engine (pure TS)  apply(state, action, rng) -> state      ← unchanged, no I/O
```

- **`GameStore`** (existing) — hotseat. Synchronous `dispatch` runs `apply()` in-memory and
  saves to localStorage. Unchanged.
- **`NetworkedGameStore`** (new) — same public interface.
  - `subscribe(cb)` attaches Firebase `onValue` to `/games/{id}/state`; remote pushes update
    the cached state and notify React listeners.
  - `dispatch(action)` runs a Firebase **transaction** on `/games/{id}/state`:
    read current → `apply(state, action, rng)` → abort on engine rejection (returning the
    engine error), else write back (Firebase tags the new version). Conflicting concurrent
    writes retry automatically against fresh state. A genuinely-stale/now-illegal action
    surfaces a toast and the board reflects the latest remote state.

`dispatch` becomes async-capable. The existing `DispatchResult` (`{ok:true} | {ok:false,
error}`) is preserved; `NetworkedGameStore.dispatch` returns a `Promise<DispatchResult>`.
The hotseat store keeps its synchronous return. Callers (`useDispatchWithError`) await a
value that may be a promise — handled uniformly.

> **Engine purity note.** `apply()` takes injected RNG. Inside a transaction the update
> function may run more than once (Firebase retries). RNG-bearing actions (roll, buy dev
> card, steal) must therefore derive their random results **once, before** entering the
> transaction, and pass those results in as part of the action — so a retry replays the
> same outcome rather than re-rolling. Actions already record their results in state
> (parent spec §4 "Randomness"); Phase 3 formalizes "resolve randomness, then commit."

---

## 4. Firebase data model

Per parent spec §5:

```
/games/{id}/state            ← public; anyone with id can read & subscribe
/games/{id}/meta             ← { createdAt, playerCount, names[], seatColors[] }
/games/{id}/seats/{i}/uid    ← which auth uid owns seat i  (public-read)
/games/{id}/_claims/{i}      ← per-seat claim token; read:false, compared on write
```

- **`net/firebase.ts`** — reads web config from Vite env (`import.meta.env`), initializes
  the app, performs silent anonymous sign-in, exposes the authed `uid`. If config is
  absent/blank, exports a "not configured" flag the lobby uses to hide online options.
- **`net/game.ts`** — `createGame(setup)`, `subscribeState(id, cb)`,
  `commitAction(id, action, resolvedRandomness)`, `claimSeat(id, seatIndex, token)`.

---

## 5. Identity & seat claiming

1. **Create game.** Creator picks player count, names, board mode. The app generates the
   initial `GameState`, N random claim tokens, writes `state` + `meta` + `_claims`, and
   shows N **secret links**: `#/g/{id}/claim/{token}` (one per seat) to copy and hand out.
2. **Claim.** Opening a claim link signs in anonymously and, if the token matches `_claims/{i}`
   (compared server-side in rules), binds `seats/{i}/uid = auth.uid`. Re-opening on a new
   device re-binds (token is the source of truth). After binding, the device knows its seat
   and routes to `#/g/{id}`.
3. **Play.** "It's your turn" vs read-only is driven by `state.turn.activeSeat === mySeat`.
   When not your turn, actions are disabled and the board is read-only.

---

## 6. Security rules (`database.rules.json`)

Enforced server-side by RTDB. Deliberately **not** a full rules validator (no engine on the
server — parent spec §5).

- All reads/writes require `auth != null` (anonymous auth satisfies this).
- `_claims` — `read: false`. A write to `seats/{i}/uid` is allowed only when the request
  presents the matching claim token (validated against `_claims/{i}`) — or re-asserts the
  same uid.
- Writes to `/state` must satisfy **all**:
  - `newData.version === data.version + 1` (rejects lost-update races), and
  - the writer's uid equals the seat that is permitted to make this write:
    - **normal move:** `seats[data.turn.activeSeat].uid`,
    - **7-discard:** any seat with an outstanding `state.discardObligations[seat] > 0`,
    - **trade acceptance:** the addressed seat, or any seat for an open offer.
- `meta` is write-once at creation by the creator's uid.

The discard/trade exceptions are scoped narrowly: those writes must still increment
`version` by exactly 1 and may only modify their own legitimate fields (enforced by rule
`.validate` predicates as far as RTDB rules allow; full legality remains the engine's job
client-side).

---

## 7. Lobby & routing

`App.tsx` gains a minimal **hash router** (no dependency; parse `location.hash`):

| Route | Screen |
|---|---|
| `#/` (or empty) | Start: **New online game** · **New hotseat game** · **Resume** (if local save) |
| `#/g/{id}` | Game view (online). Reads my seat binding; read-only if unclaimed/not my turn |
| `#/g/{id}/claim/{token}` | Claim flow → binds seat → redirects to `#/g/{id}` |

- **Online options are hidden** when Firebase is not configured — the start screen falls
  back to hotseat + resume only, so the app is always usable.
- Hotseat path is unchanged: `StartScreen` → `GameStore` + `LocalStoragePersistence`.

---

## 8. Error handling

| Condition | Behavior |
|---|---|
| No Firebase config | Online options hidden; hotseat-only; no crash |
| Anonymous auth failure | Clear message + retry button; hotseat still available |
| Transaction conflict | Firebase auto-retries against fresh state; transparent to user |
| Stale / now-illegal action | Toast ("the board changed"); board shows latest remote state |
| Engine rejects action | Existing `DispatchResult` error → existing toast path |
| Bad / missing claim token | "This invite link is invalid or expired." |
| Game id not found | "Game not found." with link back to start |

---

## 9. Testing strategy

- **Net adapter (integration, Firebase emulator):** the transaction commit path and the
  security rules — version-increment enforcement, active-seat-only writes, claim-token seat
  binding, discard/trade exceptions. This is the primary new safety net (parent spec §8).
- **Lobby/router (unit, Firebase mocked):** hash parsing, secret-link generation, claim-token
  matching, seat-binding logic, "not configured" fallback.
- **Randomness-before-commit (unit):** an RNG-bearing action committed twice (simulated
  transaction retry) yields the same recorded result.
- **Regression:** existing engine and UI suites untouched; hotseat path continues to pass.

---

## 10. Deployment

- **`.github/workflows/deploy.yml`** — on push to `master`: install, `npm run test:run`,
  `npm run build`, publish `dist/` to GitHub Pages via the official Pages actions.
- **Vite `base: '/adultingcatan/'`** so asset URLs resolve under the project path. Hash
  routing means no SPA-rewrite/404 fallback is needed.
- **Firebase web config** supplied via Vite env vars at build time (public and safe to ship;
  security lives in the rules). `.env.example` documents the variables; real values come
  from repo Actions secrets / local `.env`.
- **`firebase.json` + `database.rules.json`** version-controlled. Rules deployed via the
  Firebase CLI (one-time + on rule changes) — documented, not part of the Pages workflow.
- **One-time manual (owner):** create the free Firebase project, enable Realtime Database +
  Anonymous Auth, copy the web config into env/secrets, run `firebase deploy --only database`
  for the rules.

---

## 11. Repo additions (summary)

```
src/net/firebase.ts            init · anon auth · configured? flag
src/net/game.ts                createGame · subscribeState · commitAction · claimSeat
src/state/NetworkedGameStore.ts store seam impl over net/game
src/app/router.ts              hash route parsing
src/app/CreateOnlineGame.tsx   online create flow + secret-link sharing
src/app/ClaimSeat.tsx          claim-link handler
.github/workflows/deploy.yml   build + Pages publish
firebase.json                  emulator + deploy config
database.rules.json            RTDB security rules
.env.example                   Firebase web config variable names
vite.config.ts                 add base: '/adultingcatan/'
```

---

## 12. Implementation order

1. **Store seam + randomness-before-commit refactor** — introduce `NetworkedGameStore`
   interface and the "resolve randomness, then apply" change; prove it with the hotseat
   store still green.
2. **Firebase adapter** (`net/`) + emulator integration tests for the transaction path.
3. **Security rules** + emulator tests for version/seat/claim enforcement.
4. **Lobby, routing, claim flow** + create-online-game UI with secret links.
5. **Deploy**: Vite base, Actions workflow, `firebase.json`, `.env.example`, docs.

Each step is independently testable; the seam keeps the engine and existing UI green
throughout.

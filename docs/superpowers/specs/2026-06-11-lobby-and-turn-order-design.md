# Lobby, Rescue Links, and Turn-Order Roll-Off — Design

**Date:** 2026-06-11
**Status:** Approved (user picked: single shared link + lobby; auto-roll with reveal;
full highest-to-lowest roll ordering with tie-breaks only inside tied groups; keep a
variant of claim links for moving a seat to another device mid-game)

## Goals

1. Joining an online game means opening **one shared link**, picking your own name
   and color in a **lobby**, and waiting for the host to start.
2. Keep the existing token-based seat-rebind mechanism as **rescue links** — today
   they're how broken cookies / device moves are fixed mid-game.
3. Turn order is decided by an **opening dice roll-off** (hotseat and online), shown
   in a reveal overlay and recorded in the log.
4. Local-game buttons say **hotseat** so the mode is obvious.

## 1. Renames

- Start screen: "Start Game" → **"Start hotseat game"**.
- Resume screen: "Resume game" → **"Resume hotseat game"**; "New game" →
  **"Delete saved game"**.
- Win screen: "New game" → **"Back to menu"** (it returns to the start screen in
  both modes; hotseat additionally clears the save, as it does now).

## 2. Turn-order roll-off (engine)

`createInitialGame(players, board, rng?)` gains an optional `rng`. Without it,
behavior is unchanged (seat order; no logs) — keeps existing tests valid. With it:

- Every seat rolls 2d6. Final order sorts **highest → lowest**.
- **Ties re-roll only within the tied group**: a group of seats with equal sums
  re-rolls (recursively, if they tie again) to decide placement *inside the group*;
  everyone else's position is fixed by their original roll.
- Each roll is logged as a new `LogEntry` type `orderRoll`:
  `{ type: "orderRoll", seat, dice, sum, round }` — `round` 1 is the opening round,
  2+ are tie-break rounds (only tied seats appear in those rounds).
- `setup.order` becomes the snake over the rolled order (`[...rolled, ...rolled
  reversed]`), `turn.activeSeat = rolled[0]`.
- Pure helper `rollTurnOrder(seats: number[], rng): { order: number[]; rounds:
  Array<Array<{ seat, dice, sum }>> }` in `src/engine/order.ts`, unit-tested in
  isolation; `createInitialGame` consumes it and writes the log.

Both hotseat (`StartScreen`) and online (`startGame`) creation pass `cryptoRng()`.

### Reveal overlay (UI)

`OrderRollReveal` (`src/ui/overlays/OrderRollReveal.tsx`): rendered by `GameView`
when `phase === "setup"`, `setup.pos === 0`, the log contains `orderRoll` entries,
and it hasn't been dismissed (component state). Shows round-1 rolls per player
(staggered CSS animation), then tie-break rounds ("Tie! X and Y roll again"), then
the final order 1..n with "{first} goes first", and a **"Begin"** button to dismiss.
Derives everything from the log, so every device sees the same story. `LogRail`
renders `orderRoll` lines ("Alice rolls 4 + 5 for turn order").

## 3. Lobby

### Data model (RTDB)

```
games/{id}/
  meta:           { createdAt, host: <uid>, status: "lobby" | "active",
                    mode: "beginner" | "random" }
  lobby/{slot}:   { uid, name, color }          # slot 0..3, sparse
  _claims/{seat}: <token>                       # minted by HOST at START, write-once
  seats/{seat}:   { uid, proof? }               # written by host at start; rebindable
  state:          GameState                     # written by host at start
```

`GameMeta` (net/types.ts) becomes `{ createdAt, host, status, mode }` (old
`playerCount/names/seatColors` dropped). `SeatLink` stays for rescue links.

### Flows

**Create** — "New online game" is one tap: `createLobby()` writes `meta`
(`status: "lobby"`, `host = uid`, `mode: "beginner"`) and navigates to `#/g/{id}`.
The `CreateOnlineGame` form is deleted.

**Join** — `#/g/{id}` is the only link shared. While `status === "lobby"` it shows
the lobby: a join form (name input prefilled from `localStorage
"adultingcatan:name"`, color picker of unclaimed colors) that claims the lowest
free slot; a live roster of the 4 slots; "Copy invite link" (uses `navigator.share`
when available, else clipboard). Seated players can edit their own name/color or
leave; the **host can remove any player** (covers lost-cookie recovery before
start). Host additionally controls board mode (radio writing `meta/mode`) and
**"Start game"**, enabled at ≥3 claimed slots. The host joins through the same
form — no special seating.

**Start** — host compacts claimed slots in slot order into game seats 0..n-1, mints
one rescue token per seat, builds the board from `meta.mode`, calls
`createInitialGame(roster, board, cryptoRng())`, and commits **one atomic
multi-path update**: `state`, `seats/{i} = { uid }`, `_claims/{i} = token`,
`meta/status = "active"`. Tokens + per-seat links are saved to the host device's
`localStorage` (`"adultingcatan:claims:{id}"`). Claims racing the start fail on the
status check (tiny window where a just-claimed player misses the roster is
accepted).

**Enter game** — every lobby client watches `meta/status`; on "active" it runs the
existing `enterOnline` path (seat lookup → `NetworkedGameStore`). Opening the link
after start with no seat enters read-only spectator mode (today's bare-link
behavior). Unknown id → "Game not found".

**Rescue links** — the route `#/g/{id}/claim/{seat}/{token}` and `claimSeat()` stay
exactly as today (rebind `seats/{seat}` to a new uid given the token — already
works mid-game). The host gets a small 🔗 button in the game's top HUD (host of
this game + online only, detected via the saved localStorage entry) opening a
modal with the shareable game link and the per-seat transfer links. If the host
device loses storage, rescue links are gone — accepted, matches today.

**Old per-seat invite links die** (lobby replaces creation-time claims). No
migration.

### Security rules (database.rules.json)

- `meta`: read auth'd; create requires `newData.host === auth.uid`; updates only by
  host and cannot change `host`.
- `lobby/{slot}`: read auth'd; while `meta.status === "lobby"`: claim if empty with
  `newData.uid === auth.uid`, edit own, delete own or by host. Validate
  `hasChildren(['uid','name','color'])` and name is a 1–24 char string.
- `_claims/{seat}`: read false; write once by host.
- `seats/{seat}`: read auth'd; write by host when empty (start), OR self-rebind
  with matching `proof` token / already-owned uid (today's rule).
- `state`: create only by host; subsequent writes keep today's rule (version+1 by
  active seat, or discard/trade windows).

Both emulator suites (`tests/net/*.emulator.test.ts`) are updated: lobby
claim/steal/edit/kick cases, host-only start writes, rebind-with-proof still works,
non-host denied.

### UI structure

- `src/app/Lobby.tsx` — the lobby screen. Takes `{ id, onEnterGame }`; talks to a
  small `LobbyBackend` interface (subscribe meta+roster, claim/update/leave/kick,
  setMode, start) so component tests can fake it; `makeLobbyBackend(id)` in
  `src/net/lobby.ts` is the Firebase implementation.
- `src/app/App.tsx` — route `game`: read meta once → lobby or game; lobby
  transitions via `onEnterGame`. `ClaimSeat` route unchanged.
- `src/ui/overlays/HostLinksModal.tsx` + HUD 🔗 button — rescue links.
- `CreateOnlineGame.tsx` deleted.

## Error handling

- Lobby writes surface rule rejections as friendly toasts ("Seat just got taken —
  pick another color"); claim collisions resolve by the rule, not the client.
- Start with <3 players is prevented in UI and harmless if forced (engine throws).
- Lobby for a nonexistent id shows "Game not found".

## Testing

- Engine: `tests/engine/order.test.ts` — ordering highest→lowest, tie-break only
  permutes the tied group, nested ties, log rounds, snake derivation, no-rng
  back-compat.
- Emulator: rules matrix above.
- UI: `tests/ui/lobby.test.tsx` with a fake `LobbyBackend` (join, edit, kick
  visibility, start gating, status flip calls `onEnterGame`);
  `tests/ui/orderreveal.test.tsx`; rename assertions updated in existing
  app/persistence tests.

## Out of scope

- Public/browsable game lists (privacy; YAGNI).
- Game TTL/cleanup in Firebase (still tracked separately).
- Self-service rescue links for non-host players.
- Rematch from the win screen.

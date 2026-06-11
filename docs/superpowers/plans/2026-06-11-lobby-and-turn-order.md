# Lobby + Turn-Order Roll-Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single-link lobby with self-chosen names/colors and host-minted rescue links; opening dice roll-off that orders turns highest→lowest; hotseat-labelled buttons.

**Architecture:** Pure `rollTurnOrder` in the engine consumed by `createInitialGame(…, rng?)`; a `LobbyBackend` interface with a Firebase impl in `src/net/lobby.ts` and a `Lobby` screen consuming it; security rules move from token-claims-at-creation to lobby-claims + host-minted start-time tokens (rescue links keep today's rebind rule).

**Tech Stack:** React 19, Firebase RTDB + anonymous auth, Vitest (+ rules-unit-testing emulator suite).

Spec: `docs/superpowers/specs/2026-06-11-lobby-and-turn-order-design.md`

---

### Task 1: Engine roll-off

**Files:** Create `src/engine/order.ts`, `tests/engine/order.test.ts`; Modify `src/engine/types.ts` (LogEntry), `src/engine/state.ts`, `src/engine/index.ts`.

- [ ] Test first (`tests/engine/order.test.ts`): with `mulberry32` seeds assert — (a) order sorts round-1 sums desc; (b) a tie re-rolls ONLY the tied seats (later rounds contain exactly those seats; non-tied seats keep positions); (c) nested ties recurse; (d) `createInitialGame` without rng has no `orderRoll` logs and order `[0..n-1]`; with rng, `setup.order` is `[...rolled, ...reversed]`, `turn.activeSeat === rolled[0]`, log rounds numbered from 1.
- [ ] Run → FAIL (module missing).
- [ ] Implement `src/engine/order.ts`:

```ts
import type { Rng } from "./rng";
export interface OrderRoll { seat: number; dice: [number, number]; sum: number }
export function rollTurnOrder(seats: number[], rng: Rng): { order: number[]; rounds: OrderRoll[][] } {
  const rounds: OrderRoll[][] = [];
  const order = resolve(seats, rng, rounds);
  return { order, rounds };
}
function resolve(seats: number[], rng: Rng, rounds: OrderRoll[][]): number[] {
  const d6 = () => 1 + rng.nextInt(6);
  const rolls: OrderRoll[] = seats.map((seat) => {
    const dice: [number, number] = [d6(), d6()];
    return { seat, dice, sum: dice[0] + dice[1] };
  });
  rounds.push(rolls);
  const bySum = new Map<number, number[]>();
  for (const r of rolls) bySum.set(r.sum, [...(bySum.get(r.sum) ?? []), r.seat]);
  const order: number[] = [];
  for (const sum of [...bySum.keys()].sort((a, b) => b - a)) {
    const group = bySum.get(sum)!;
    if (group.length === 1) order.push(group[0]!);
    else order.push(...resolve(group, rng, rounds)); // tie-break: permutes only this group
  }
  return order;
}
```

- [ ] `types.ts`: add `"orderRoll"` to `LogEntry["type"]` union and optional `round?: number` field.
- [ ] `state.ts`: `createInitialGame(players, board, rng?)` — when rng given, run `rollTurnOrder`, push `{ type: "orderRoll", seat, dice, sum, round: i + 1 }` per roll into the initial log, snake the rolled order; otherwise current behavior. Keep `snakeOrder` export untouched.
- [ ] `LogRail`: `case "orderRoll": return `${name} rolled ${e.sum} for turn order`;`
- [ ] Run order tests + full engine suite → PASS. Commit `feat: turn-order roll-off in engine`.

### Task 2: Reveal overlay + creation sites

**Files:** Create `src/ui/overlays/OrderRollReveal.tsx`, `tests/ui/orderreveal.test.tsx`; Modify `src/ui/GameView.tsx`, `src/app/StartScreen.tsx`, `src/ui/styles.css`.

- [ ] Test: hotseat game from `createInitialGame(players, board, mulberry32(7))` → GameView shows dialog "Turn order" listing each player's round-1 roll and "{first} goes first"; "Begin" dismisses; game without orderRoll logs renders no dialog.
- [ ] Implement `OrderRollReveal` (renders from `useGame()`):
  - Guard: `phase==="setup" && setup?.pos===0 && log.some(orderRoll) && !dismissed`.
  - Group `orderRoll` entries by `round`; render each round as rows `swatch · name · 🎲 a + b = sum` (stagger `animationDelay` per row); rounds ≥2 prefixed "Tie-break:".
  - Footer: ordered list from `setup.order.slice(0, players.length)` names, headline "{players[setup.order[0]].name} goes first", `btn-primary` **Begin**.
- [ ] Mount `<OrderRollReveal />` in GameView next to `<WinScreen />`. StartScreen already builds `cryptoRng()` — pass it: `createInitialGame(players, board, rng)`. CSS: `.order-reveal` reuses dialog overlay pattern + row drop-in keyframes.
- [ ] Suite green → commit `feat: opening roll-off reveal overlay`.

### Task 3: Hotseat renames

**Files:** `src/app/StartScreen.tsx`, `src/app/App.tsx`, `src/ui/overlays/WinScreen.tsx` + the tests asserting old labels (`tests/ui/app.test.tsx`, `tests/ui/winscreen.test.tsx`, others found by grep).

- [ ] "Start Game" → "Start hotseat game"; resume screen "Resume game" → "Resume hotseat game", "New game" → "Delete saved game"; win screen "New game" → "Back to menu". Update test assertions (grep `Start Game|Resume game|New game`). Suite green → commit `feat: label hotseat actions explicitly`.

### Task 4: Net layer + rules

**Files:** Create `src/net/lobby.ts`; Modify `src/net/types.ts`, `src/net/game.ts` (remove createGame), `database.rules.json`, both `tests/net/*.emulator.test.ts`.

- [ ] `types.ts`: `GameMeta = { createdAt: number; host: string; status: "lobby" | "active"; mode: "beginner" | "random" }`; keep `SeatLink`.
- [ ] `src/net/lobby.ts`:

```ts
export interface LobbySeat { uid: string; name: string; color: string }
export interface LobbyView { meta: GameMeta | null; roster: Record<number, LobbySeat>; myUid: string }
export interface LobbyBackend {
  subscribe(cb: (v: LobbyView) => void): () => void;
  claim(slot: number, name: string, color: string): Promise<void>;
  leave(slot: number): Promise<void>;
  kick(slot: number): Promise<void>;
  setMode(mode: GameMeta["mode"]): Promise<void>;
  start(): Promise<void>;
}
export async function createLobby(): Promise<string>           // meta {createdAt, host: uid, status:"lobby", mode:"beginner"}
export async function getMeta(id: string): Promise<GameMeta | null>
export function makeLobbyBackend(id: string): LobbyBackend     // two onValue subs (meta, lobby) merged
export function hostRescueLinks(id: string): SeatLink[] | null // localStorage adultingcatan:claims:{id}
```

  `claim` doubles as own-seat update (rule allows). `start()`: `get` lobby, compact slots ascending → roster; tokens = `randomId(16)` per seat; board from `meta.mode` (+`cryptoRng()`); `createInitialGame(roster, board, cryptoRng())`; one `update(ref(games/{id}), { state, "meta/status": "active", "seats/{i}": { uid }, "_claims/{i}": token })`; persist `SeatLink[]` to localStorage. `randomId` moves to lobby.ts (exported) or a shared util; `game.ts` keeps `claimSeat`, `seatForUid`, `makeRtdbBackend` and drops `createGame`.
- [ ] `database.rules.json` (full replacement of the `games/$gameId` children):

```json
"meta": { ".read": "auth != null",
  ".write": "auth != null && ((!data.exists() && newData.child('host').val() === auth.uid) || (data.exists() && data.child('host').val() === auth.uid && newData.child('host').val() === data.child('host').val()))" },
"lobby": { ".read": "auth != null",
  "$slot": {
    ".write": "auth != null && root.child('games/'+$gameId+'/meta/status').val() === 'lobby' && ((newData.exists() && newData.child('uid').val() === auth.uid && (!data.exists() || data.child('uid').val() === auth.uid)) || (!newData.exists() && data.exists() && (data.child('uid').val() === auth.uid || root.child('games/'+$gameId+'/meta/host').val() === auth.uid)))",
    ".validate": "newData.hasChildren(['uid','name','color']) && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 24" } },
"_claims": { ".read": false,
  "$claimSeat": { ".write": "auth != null && !data.exists() && root.child('games/'+$gameId+'/meta/host').val() === auth.uid" } },
"seats": { ".read": "auth != null",
  "$seat": { ".write": "auth != null && ((!data.exists() && root.child('games/'+$gameId+'/meta/host').val() === auth.uid) || (newData.child('uid').val() === auth.uid && (data.child('uid').val() === auth.uid || newData.child('proof').val() === root.child('games/'+$gameId+'/_claims/'+$seat).val())))",
    ".validate": "newData.hasChildren(['uid'])", "proof": { ".read": false } } },
"state": { ".read": "auth != null",
  ".write": "auth != null && newData.exists() && ((!data.exists() && root.child('games/'+$gameId+'/meta/host').val() === auth.uid) || (data.exists() && newData.child('version').val() === data.child('version').val() + 1 && (root.child('games/'+$gameId+'/seats/'+data.child('turn/activeSeat').val()+'/uid').val() === auth.uid || data.child('discardObligations').exists() || data.child('tradeOffers').exists())))" }
```

- [ ] Emulator tests (`npm run test:emulator`): rewrite cases — meta create binds host=self (other uid denied); lobby claim empty slot OK, steal denied, edit own OK, kick by host OK / by stranger denied, claim after status=active denied; host start multi-path update OK, non-host denied; rebind seat with proof OK (the rescue path), wrong proof denied; state create by host only; existing version/turn cases keep passing with meta seeded.
- [ ] Emulator suite green → commit `feat: lobby data model + rules`.

### Task 5: Lobby UI + routing

**Files:** Create `src/app/Lobby.tsx`, `tests/ui/lobby.test.tsx`; Modify `src/app/App.tsx`, `src/app/StartScreen.tsx`, `src/ui/styles.css`; Delete `src/app/CreateOnlineGame.tsx` (+ its uses in tests).

- [ ] Tests (fake `LobbyBackend` with controllable `LobbyView` pushes): join form claims a slot with typed name + picked color; roster renders claimed seats live; "(you)" + Leave on own seat; kick ✕ visible only to host and not on self; Start disabled <3 and enabled ≥3 (host only); pushing `status:"active"` calls `onEnterGame(id)`; null meta → "Game not found".
- [ ] `Lobby({ id, backend, onEnterGame })`: subscribe in effect; name input prefilled from `localStorage "adultingcatan:name"` (saved on claim); color picker over free `COLORS`; join → `claim(lowestFreeSlot, …)`; own seat row → Leave; host rows → ✕ kick; host: mode radios (`setMode`) + Start; everyone: "Copy invite link" (`navigator.share` fallback `clipboard.writeText`), code `{id}` shown. Errors → inline `role="alert"`.
- [ ] `App.tsx`: route `game` + no store → `getMeta`: null → joinError "Game not found."; `"lobby"` → render `<Lobby id backend={makeLobbyBackend(id)} onEnterGame={enterOnline} />`; `"active"` → `enterOnline` (existing). "New online game" button → `createLobby()` then `location.hash = "#/g/"+id` (busy state on StartScreen prop). Delete `CreateOnlineGame`.
- [ ] Suite green → commit `feat: single-link lobby`.

### Task 6: Host rescue links in-game

**Files:** Create `src/ui/overlays/HostLinksModal.tsx`; Modify `src/ui/GameView.tsx`, `src/ui/styles.css`; extend `tests/ui/lobby.test.tsx` or new test.

- [ ] GameView (online only): parse game id from `location.hash`; if `hostRescueLinks(id)` non-null show 🔗 button in `.top-hud`; modal lists shareable game link + per-seat links labelled with `state.players[seat].name`, copy buttons, close. Test with seeded localStorage.
- [ ] Suite green → commit `feat: host rescue-link modal`.

### Task 7: Verification

- [ ] `npm run typecheck` clean; `npx vitest run` all green; `npm run test:emulator` green.
- [ ] Screenshot lobby + reveal overlay via the WSL Windows-Chrome workflow (memory: wsl-screenshot-workflow); lobby needs Firebase so screenshot hotseat reveal + lobby with a faked backend page if emulator hookup is impractical — otherwise reveal only and note it.
- [ ] Push to origin master.

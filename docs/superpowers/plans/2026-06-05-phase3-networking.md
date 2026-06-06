# Phase 3 — Networking, Lobby & Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local hotseat Catan game into an async, multi-device game hosted on GitHub Pages, backed by Firebase Realtime Database, without touching the rules engine.

**Architecture:** A `Store` interface captures the existing `{getState, subscribe, dispatch}` seam. The hotseat `GameStore` keeps working unchanged; a new `NetworkedGameStore` implements the same interface over a thin `RtdbBackend` abstraction, so its conflict/seed logic is unit-testable with a fake backend and the Firebase-specific code stays isolated in `src/net/`. A hash router adds create-online and claim-seat flows. Security lives in version-controlled RTDB rules; CI builds and publishes to Pages.

**Tech Stack:** TypeScript, React 19, Vite 8, Vitest 4, Firebase Realtime Database (modular SDK v11), `@firebase/rules-unit-testing` for rules tests, GitHub Actions.

**Reference spec:** [docs/superpowers/specs/2026-06-05-phase3-networking-design.md](../specs/2026-06-05-phase3-networking-design.md)

---

## File Structure

**New files:**
- `src/state/store.ts` — `Store` interface + `DispatchResult` (moved from gameStore).
- `src/state/seed.ts` — `randomSeed()` crypto-backed uint32.
- `src/state/NetworkedGameStore.ts` — networked store over `RtdbBackend`.
- `src/net/types.ts` — `RtdbBackend`, `GameMeta`, claim/link types.
- `src/net/firebase.ts` — Firebase app init, anon auth, `isFirebaseConfigured`.
- `src/net/game.ts` — `createGame`, `makeRtdbBackend`, `claimSeat`, `seatForUid`.
- `src/net/config.ts` — read `import.meta.env.VITE_FIREBASE_*` into a config object.
- `src/app/router.ts` — pure hash-route parsing.
- `src/app/CreateOnlineGame.tsx` — online create flow + secret-link sharing.
- `src/app/ClaimSeat.tsx` — claim-link handler.
- `database.rules.json` — RTDB security rules.
- `firebase.json` — emulator + deploy config.
- `.env.example` — Firebase web-config variable names.
- `.github/workflows/deploy.yml` — build + Pages publish.
- Tests: `tests/state/seed.test.ts`, `tests/state/networkedGameStore.test.ts`, `tests/net/game.emulator.test.ts`, `tests/net/rules.emulator.test.ts`, `tests/app/router.test.ts`.

**Modified files:**
- `src/state/gameStore.ts` — implement `Store`; import `DispatchResult` from `store.ts`.
- `src/ui/useDispatchWithError.ts` — `await Promise.resolve(dispatch(a))`.
- `src/app/App.tsx` — hash-route dispatch (start / online game / claim).
- `package.json` — add `firebase`, `@firebase/rules-unit-testing`; add emulator test scripts.

**NOT changed:** the entire `src/engine/` tree, `src/board/`, and all existing engine/UI tests. `vite.config.ts` already has `base: "./"` (relative), which is correct for a Pages project site — do **not** change it.

---

## Task 1: Store seam (interface + seed helper + async-safe dispatch)

**Files:**
- Create: `src/state/store.ts`, `src/state/seed.ts`, `tests/state/seed.test.ts`
- Modify: `src/state/gameStore.ts`, `src/ui/useDispatchWithError.ts`

- [ ] **Step 1: Create the `Store` interface**

Create `src/state/store.ts`:

```ts
import type { GameState, Action } from "../engine/types";

export type DispatchResult = { ok: true } | { ok: false; error: string };

/** The seam every view consumes. Hotseat returns sync; networked returns a promise. */
export interface Store {
  getState(): GameState;
  subscribe(cb: () => void): () => void;
  dispatch(action: Action): DispatchResult | Promise<DispatchResult>;
}
```

- [ ] **Step 2: Point `gameStore.ts` at the shared types**

Modify `src/state/gameStore.ts` — remove its local `DispatchResult` and declare it implements `Store`:

```ts
import type { GameState, Action } from "../engine/types";
import type { Rng } from "../engine/rng";
import { apply } from "../engine";
import type { Persistence } from "./persistence";
import type { Store, DispatchResult } from "./store";

export type { DispatchResult };

export class GameStore implements Store {
  private state: GameState;
  private listeners = new Set<() => void>();

  constructor(
    initial: GameState,
    private persistence: Persistence,
    private rng: Rng,
  ) {
    this.state = initial;
  }

  getState = (): GameState => this.state;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  dispatch = (action: Action): DispatchResult => {
    const result = apply(this.state, action, this.rng);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.persistence.save(this.state);
    this.listeners.forEach((l) => l());
    return { ok: true };
  };
}
```

- [ ] **Step 3: Write the failing test for `randomSeed`**

Create `tests/state/seed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { randomSeed } from "../../src/state/seed";

describe("randomSeed", () => {
  it("returns a 32-bit unsigned integer", () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it("varies across calls", () => {
    const seeds = new Set(Array.from({ length: 50 }, () => randomSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm run test:run -- tests/state/seed.test.ts`
Expected: FAIL — cannot resolve `../../src/state/seed`.

- [ ] **Step 5: Implement `randomSeed`**

Create `src/state/seed.ts`:

```ts
/** A crypto-backed 32-bit seed for mulberry32. Generated once per networked dispatch. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  }
  return (Date.now() >>> 0) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0);
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npm run test:run -- tests/state/seed.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Make `useDispatchWithError` async-safe**

Modify `src/ui/useDispatchWithError.ts` — the `run` callback awaits a possibly-async dispatch:

```ts
import { useCallback, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Action } from "../engine/types";

/**
 * Dispatch an action and capture a rejected dispatch's error for a Toast.
 * Handles both the hotseat (sync) and networked (promise) dispatch returns.
 */
export function useDispatchWithError(): {
  run: (a: Action) => void;
  error: string | null;
  dismissError: () => void;
} {
  const { dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    (a: Action) => {
      void Promise.resolve(dispatch(a)).then((r) => {
        if (!r.ok) setError(r.error);
      });
    },
    [dispatch],
  );
  const dismissError = useCallback(() => setError(null), []);
  return { run, error, dismissError };
}
```

- [ ] **Step 8: Update `GameProvider`'s dispatch type**

Modify `src/state/GameProvider.tsx` — widen the dispatch return type to match `Store`:

```ts
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Store, DispatchResult } from "./store";
import type { GameState, Action } from "../engine/types";

const StoreContext = createContext<Store | null>(null);

export function GameProvider({ store, children }: { store: Store; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useGame(): {
  state: GameState;
  dispatch: (a: Action) => DispatchResult | Promise<DispatchResult>;
} {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGame must be used within a GameProvider");
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state, dispatch: store.dispatch };
}
```

- [ ] **Step 9: Verify the whole suite + typecheck still pass**

Run: `npm run typecheck && npm run test:run`
Expected: PASS — no engine/UI test regressions (the seam change is type-compatible).

- [ ] **Step 10: Commit**

```bash
git add src/state/store.ts src/state/seed.ts src/state/gameStore.ts src/state/GameProvider.tsx src/ui/useDispatchWithError.ts tests/state/seed.test.ts
git commit -m "feat(state): Store seam + crypto seed helper + async-safe dispatch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: NetworkedGameStore over an `RtdbBackend` abstraction

The networked store never imports Firebase. It depends on a small `RtdbBackend` that the
real adapter (Task 3) and a fake (this task's tests) both implement. This is where the
seed-injection + conflict handling live and get unit-tested without the emulator.

**Files:**
- Create: `src/net/types.ts`, `src/state/NetworkedGameStore.ts`, `tests/state/networkedGameStore.test.ts`

- [ ] **Step 1: Define the backend abstraction**

Create `src/net/types.ts`:

```ts
import type { GameState } from "../engine/types";

/** Result of a transactional commit attempt. */
export type CommitResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/**
 * Minimal Realtime-Database surface the networked store needs.
 * `commit` runs `update` against the freshest state, retrying on contention;
 * `update` returns the next state, or a string error to abort the transaction.
 */
export interface RtdbBackend {
  subscribe(cb: (state: GameState | null) => void): () => void;
  commit(update: (current: GameState | null) => GameState | string): Promise<CommitResult>;
}

export interface GameMeta {
  createdAt: number;
  playerCount: number;
  names: string[];
  seatColors: string[];
}

export interface SeatLink {
  seat: number;
  url: string;
}
```

- [ ] **Step 2: Write the failing tests for NetworkedGameStore**

Create `tests/state/networkedGameStore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NetworkedGameStore } from "../../src/state/NetworkedGameStore";
import type { RtdbBackend, CommitResult } from "../../src/net/types";
import { createInitialGame, cryptoRng } from "../../src/engine";
import { createBoard } from "../../src/board";
import type { GameState } from "../../src/engine/types";

function freshGame(): GameState {
  const board = createBoard({ mode: "beginner" });
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    board,
  );
}

/** A fake backend that records the update fn and lets a test drive commits/pushes. */
class FakeBackend implements RtdbBackend {
  current: GameState | null;
  lastUpdate: ((c: GameState | null) => GameState | string) | null = null;
  private cb: ((s: GameState | null) => void) | null = null;
  /** simulate a transaction retry: run the update `attempts` times before persisting */
  attempts = 1;

  constructor(initial: GameState) { this.current = initial; }

  subscribe(cb: (s: GameState | null) => void) { this.cb = cb; cb(this.current); return () => { this.cb = null; }; }

  async commit(update: (c: GameState | null) => GameState | string): Promise<CommitResult> {
    this.lastUpdate = update;
    let result: GameState | string = "";
    for (let i = 0; i < this.attempts; i++) result = update(this.current);
    if (typeof result === "string") return { ok: false, error: result };
    this.current = result;
    this.cb?.(this.current);
    return { ok: true, state: result };
  }
}

describe("NetworkedGameStore", () => {
  it("renders the latest remote state to subscribers", () => {
    const game = freshGame();
    const backend = new FakeBackend(game);
    const store = new NetworkedGameStore(backend, 0);
    expect(store.getState()).toEqual(game);
  });

  it("rejects an illegal action with the engine error and does not change state", async () => {
    const backend = new FakeBackend(freshGame());
    const store = new NetworkedGameStore(backend, 0);
    // rolling is illegal during setup
    const r = await store.dispatch({ type: "rollDice" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.error).toBe("string");
  });

  it("produces identical dice even when the transaction update runs twice (retry-safe)", async () => {
    // advance a game to awaitingRoll by completing setup deterministically would be long;
    // instead assert the seed contract: two runs of the same commit see the same dice.
    const game = freshGame();
    // force main-phase awaitingRoll directly for the unit test
    game.phase = "main";
    game.turn.subPhase = "awaitingRoll";
    const backend = new FakeBackend(game);
    backend.attempts = 2; // simulate one retry
    const store = new NetworkedGameStore(backend, 0);
    const r = await store.dispatch({ type: "rollDice" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // run the recorded update once more against the SAME input: dice must match
      const replay = backend.lastUpdate!(game);
      expect(typeof replay).not.toBe("string");
      if (typeof replay !== "string") {
        expect(replay.turn.dice).toEqual(r.state.turn.dice);
      }
    }
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm run test:run -- tests/state/networkedGameStore.test.ts`
Expected: FAIL — cannot resolve `NetworkedGameStore`.

- [ ] **Step 4: Implement NetworkedGameStore**

Create `src/state/NetworkedGameStore.ts`:

```ts
import type { GameState, Action } from "../engine/types";
import { apply, mulberry32 } from "../engine";
import { randomSeed } from "./seed";
import type { Store, DispatchResult } from "./store";
import type { RtdbBackend, CommitResult } from "../net/types";

/**
 * Online store. `dispatch` commits the engine result inside a backend transaction.
 * Randomness is seeded ONCE before the transaction and reconstructed inside each
 * attempt, so a retry replays identical dice / steals / draws. Engine is untouched.
 */
export class NetworkedGameStore implements Store {
  private state: GameState | null;
  private listeners = new Set<() => void>();

  constructor(private backend: RtdbBackend, private mySeat: number) {
    this.state = null;
    backend.subscribe((s) => {
      this.state = s;
      this.listeners.forEach((l) => l());
    });
  }

  /** Which seat this device controls (for the UI's read-only / your-turn logic). */
  seat(): number { return this.mySeat; }

  getState = (): GameState => {
    if (this.state === null) throw new Error("Game state not loaded yet");
    return this.state;
  };

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  dispatch = async (action: Action): Promise<DispatchResult> => {
    const seed = randomSeed();
    const result: CommitResult = await this.backend.commit((current) => {
      if (current === null) return "Game is not available";
      const rng = mulberry32(seed); // fresh per attempt → deterministic replay
      const applied = apply(current, action, rng);
      if (!applied.ok) return applied.error;
      return applied.state;
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:run -- tests/state/networkedGameStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + full suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/net/types.ts src/state/NetworkedGameStore.ts tests/state/networkedGameStore.test.ts
git commit -m "feat(net): NetworkedGameStore with seed-injection over RtdbBackend

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Firebase adapter (init, auth, backend, createGame, claimSeat)

**Files:**
- Create: `src/net/config.ts`, `src/net/firebase.ts`, `src/net/game.ts`, `.env.example`, `firebase.json`, `tests/net/game.emulator.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Firebase dependencies**

Run:
```bash
npm install firebase
npm install -D @firebase/rules-unit-testing
```

- [ ] **Step 2: Config reader**

Create `src/net/config.ts`:

```ts
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

/** Reads Vite env. Returns null when not configured (→ hotseat-only). */
export function readFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  if (!databaseURL || !apiKey) return null;
  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    databaseURL,
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
    appId: env.VITE_FIREBASE_APP_ID ?? "",
  };
}
```

- [ ] **Step 3: `.env.example`**

Create `.env.example`:

```
# Firebase web config (public — safe to ship; security lives in database.rules.json).
# Copy to `.env` for local dev and add as GitHub Actions secrets for deploy.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 4: Firebase init + anon auth**

Create `src/net/firebase.ts`:

```ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { readFirebaseConfig } from "./config";

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

function ensureApp(): { db: Database; auth: Auth } {
  if (app === null) {
    const config = readFirebaseConfig();
    if (config === null) throw new Error("Firebase is not configured");
    app = initializeApp(config);
    db = getDatabase(app);
    auth = getAuth(app);
  }
  return { db: db!, auth: auth! };
}

/** Signs in anonymously (idempotent) and resolves the stable uid for this browser. */
export function ensureSignedIn(): Promise<string> {
  const { auth } = ensureApp();
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.uid); }
    });
    signInAnonymously(auth).catch((e) => { unsub(); reject(e); });
  });
}

export function database(): Database {
  return ensureApp().db;
}
```

- [ ] **Step 5: Game adapter — createGame, backend, claimSeat**

Create `src/net/game.ts`:

```ts
import { ref, get, set, onValue, runTransaction } from "firebase/database";
import type { GameState } from "../engine/types";
import type { NewPlayer } from "../engine";
import { createInitialGame } from "../engine";
import { createBoard } from "../board";
import { mulberry32, cryptoRng } from "../engine";
import { database, ensureSignedIn } from "./firebase";
import type { RtdbBackend, CommitResult, GameMeta, SeatLink } from "./types";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomId(len: number): string {
  const buf = new Uint32Array(len);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ID_ALPHABET[buf[i]! % ID_ALPHABET.length];
  return out;
}

export interface CreateGameInput {
  players: NewPlayer[];
  mode: "beginner" | "random";
}

/** Writes a new game (state + meta + claim tokens) and returns its id + per-seat links. */
export async function createGame(input: CreateGameInput): Promise<{ id: string; links: SeatLink[] }> {
  await ensureSignedIn();
  const id = randomId(6);
  const rng = input.mode === "random" ? cryptoRng() : mulberry32(1);
  const board = input.mode === "random" ? createBoard({ mode: "random", rng }) : createBoard({ mode: "beginner" });
  const state = createInitialGame(input.players, board);
  const meta: GameMeta = {
    createdAt: Date.now(),
    playerCount: input.players.length,
    names: input.players.map((p) => p.name),
    seatColors: input.players.map((p) => p.color),
  };
  const tokens = input.players.map(() => randomId(16));

  await set(ref(database(), `games/${id}/state`), state);
  await set(ref(database(), `games/${id}/meta`), meta);
  for (let i = 0; i < tokens.length; i++) {
    await set(ref(database(), `games/${id}/_claims/${i}`), tokens[i]);
  }

  const base = `${location.origin}${location.pathname}`;
  const links: SeatLink[] = tokens.map((t, seat) => ({
    seat,
    url: `${base}#/g/${id}/claim/${seat}/${t}`,
  }));
  return { id, links };
}

/** Binds this browser's uid to a seat if the token matches. Returns the seat index. */
export async function claimSeat(id: string, seat: number, token: string): Promise<number> {
  const uid = await ensureSignedIn();
  // proof is written to a read:false subpath; the rule validates it against _claims/{seat}
  await set(ref(database(), `games/${id}/seats/${seat}`), { uid, proof: token });
  return seat;
}

/** Reads which seat (if any) the current uid owns in a game. -1 if none. */
export async function seatForUid(id: string): Promise<number> {
  const uid = await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/seats`));
  const seats = (snap.val() as Record<string, { uid?: string }> | null) ?? {};
  for (const [k, v] of Object.entries(seats)) if (v?.uid === uid) return Number(k);
  return -1;
}

/** A Firebase-backed RtdbBackend for the NetworkedGameStore. */
export function makeRtdbBackend(id: string): RtdbBackend {
  const stateRef = ref(database(), `games/${id}/state`);
  return {
    subscribe(cb) {
      return onValue(stateRef, (snap) => cb((snap.val() as GameState | null) ?? null));
    },
    async commit(update): Promise<CommitResult> {
      let abortError: string | null = null;
      const tx = await runTransaction(stateRef, (current: GameState | null) => {
        const next = update(current);
        if (typeof next === "string") { abortError = next; return; } // abort
        return next;
      });
      if (abortError !== null) return { ok: false, error: abortError };
      if (!tx.committed) return { ok: false, error: "The board changed — please retry." };
      return { ok: true, state: tx.snapshot.val() as GameState };
    },
  };
}
```

- [ ] **Step 6: `firebase.json` (emulator + deploy targets)**

Create `firebase.json`:

```json
{
  "database": { "rules": "database.rules.json" },
  "emulators": {
    "database": { "port": 9000 },
    "auth": { "port": 9099 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 7: Emulator integration test for createGame + commit + seat claim**

> Requires the Firebase emulator. This test is gated behind a script (Step 8) and is NOT
> part of the default `npm run test:run` CI gate.

Create `tests/net/game.emulator.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, runTransaction } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

describe("rtdb game lifecycle (emulator)", () => {
  it("writes and reads back a state blob under a transaction", async () => {
    const ctx = env.authenticatedContext("uid-a");
    const db = ctx.database();
    await set(ref(db, "games/g1/seats/0"), { uid: "uid-a", proof: "tok0" });
    await set(ref(db, "games/g1/_claims/0"), "tok0");
    await set(ref(db, "games/g1/state"), { version: 0, turn: { activeSeat: 0 } });
    const tx = await runTransaction(ref(db, "games/g1/state"), (s: any) =>
      s ? { ...s, version: s.version + 1 } : s,
    );
    expect(tx.committed).toBe(true);
    const snap = await get(ref(db, "games/g1/state"));
    expect(snap.val().version).toBe(1);
  });
});
```

> Note: this test seeds `_claims`/`seats` directly as `uid-a` because rules are not yet
> written (Task 4). After Task 4 it still passes because `uid-a` is the active seat and
> presents the matching proof.

- [ ] **Step 8: Add emulator test scripts**

Modify `package.json` `scripts` — add:

```json
"test:emulator": "firebase emulators:exec --only database,auth \"vitest run tests/net\"",
"rules:deploy": "firebase deploy --only database"
```

- [ ] **Step 9: Run the emulator integration test**

Run: `npx firebase emulators:exec --only database,auth "npx vitest run tests/net/game.emulator.test.ts"`
Expected: PASS. (Requires `firebase-tools`; if absent run `npm i -D firebase-tools` first.)

- [ ] **Step 10: Typecheck + unit suite (no emulator)**

Run: `npm run typecheck && npm run test:run`
Expected: PASS — note `tests/net/*.emulator.test.ts` are excluded from `test:run` (Step 11).

- [ ] **Step 11: Exclude emulator tests from the default gate**

Modify `vitest.config.ts` so the default run skips emulator tests:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "tests/net/**"], // emulator suites run via test:emulator
    environment: "node",
    setupFiles: ["tests/setup-dom.ts"],
  },
});
```

- [ ] **Step 12: Commit**

```bash
git add src/net/config.ts src/net/firebase.ts src/net/game.ts .env.example firebase.json vitest.config.ts package.json package-lock.json tests/net/game.emulator.test.ts
git commit -m "feat(net): Firebase adapter — init, anon auth, createGame, claimSeat, backend

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Security rules + rules tests

Rules enforce: authed-only access; `_claims` is private; seat binding requires the matching
proof token; `/state` writes must increment `version` by exactly 1 and come from the active
seat (with discard/trade exceptions).

**Files:**
- Create: `database.rules.json`, `tests/net/rules.emulator.test.ts`

- [ ] **Step 1: Write the rules**

Create `database.rules.json`:

```json
{
  "rules": {
    "games": {
      "$gameId": {
        "meta": {
          ".read": "auth != null",
          ".write": "auth != null && !data.exists()"
        },
        "_claims": {
          ".read": false,
          ".write": "auth != null && !data.exists()"
        },
        "seats": {
          ".read": "auth != null",
          "$seat": {
            ".write": "auth != null && newData.child('uid').val() === auth.uid && (data.child('uid').val() === auth.uid || newData.child('proof').val() === root.child('games/'+$gameId+'/_claims/'+$seat).val())",
            "proof": { ".read": false },
            ".validate": "newData.hasChildren(['uid'])"
          }
        },
        "state": {
          ".read": "auth != null",
          ".write": "auth != null && newData.exists() && (!data.exists() || (newData.child('version').val() === data.child('version').val() + 1 && (root.child('games/'+$gameId+'/seats/'+data.child('turn/activeSeat').val()+'/uid').val() === auth.uid || data.child('discardObligations').hasChild(seatOf(auth.uid)) )))"
        }
      }
    }
  }
}
```

> **Implementation note for the engineer:** RTDB rules have no function calls, so the
> `seatOf(...)` pseudo-expression above is a placeholder for the discard exception that
> cannot be expressed inline. Replace the `state` `.write` with the concrete form below,
> which drops the unsupported helper and instead allows a write either from the active
> seat, or from **any** authed seat when `discardObligations` is non-empty (a deliberately
> loose discard exception — acceptable under the trust-the-friends model, spec §6):

```json
"state": {
  ".read": "auth != null",
  ".write": "auth != null && newData.exists() && (!data.exists() || (newData.child('version').val() === data.child('version').val() + 1 && (root.child('games/'+$gameId+'/seats/'+data.child('turn/activeSeat').val()+'/uid').val() === auth.uid || data.child('discardObligations').exists())))"
}
```

Use the second form. The first is shown only to explain why the helper was removed.

- [ ] **Step 2: Write rules tests**

Create `tests/net/rules.emulator.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.database();
    await set(ref(db, "games/g/_claims/0"), "tokenZero");
    await set(ref(db, "games/g/state"), { version: 0, turn: { activeSeat: 0 } });
  });
}

describe("rtdb security rules (emulator)", () => {
  beforeAll(seed);

  it("denies reading another seat's claim token", async () => {
    const db = env.authenticatedContext("eve").database();
    await assertFails(import("firebase/database").then(({ get, ref }) => get(ref(db, "games/g/_claims/0"))));
  });

  it("binds a seat when the proof token matches", async () => {
    const db = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(db, "games/g/seats/0"), { uid: "alice", proof: "tokenZero" }));
  });

  it("rejects a seat bind with a wrong token", async () => {
    const db = env.authenticatedContext("mallory").database();
    await assertFails(set(ref(db, "games/g/seats/1"), { uid: "mallory", proof: "wrong" }));
  });

  it("lets the active seat advance version by exactly 1", async () => {
    const db = env.authenticatedContext("alice").database(); // alice owns seat 0 (active)
    await assertSucceeds(set(ref(db, "games/g/state"), { version: 1, turn: { activeSeat: 0 } }));
  });

  it("rejects a write from a non-active seat", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/1"), { uid: "bob" });
    });
    const db = env.authenticatedContext("bob").database(); // seat 1, not active
    await assertFails(set(ref(db, "games/g/state"), { version: 2, turn: { activeSeat: 0 } }));
  });

  it("rejects a version skip", async () => {
    const db = env.authenticatedContext("alice").database();
    await assertFails(set(ref(db, "games/g/state"), { version: 99, turn: { activeSeat: 0 } }));
  });
});
```

- [ ] **Step 3: Run rules tests against the emulator**

Run: `npx firebase emulators:exec --only database,auth "npx vitest run tests/net/rules.emulator.test.ts"`
Expected: PASS (6 tests). Iterate on `database.rules.json` until green — rules are fiddly; the emulator is the source of truth.

- [ ] **Step 4: Commit**

```bash
git add database.rules.json tests/net/rules.emulator.test.ts
git commit -m "feat(net): RTDB security rules + emulator rules tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Lobby, hash routing, create-online & claim UI

**Files:**
- Create: `src/app/router.ts`, `src/app/CreateOnlineGame.tsx`, `src/app/ClaimSeat.tsx`, `tests/app/router.test.ts`
- Modify: `src/app/App.tsx`, `src/app/StartScreen.tsx`

- [ ] **Step 1: Write failing router tests**

Create `tests/app/router.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseRoute } from "../../src/app/router";

describe("parseRoute", () => {
  it("treats empty / root hash as the start screen", () => {
    expect(parseRoute("")).toEqual({ kind: "start" });
    expect(parseRoute("#/")).toEqual({ kind: "start" });
  });
  it("parses a game route", () => {
    expect(parseRoute("#/g/abc123")).toEqual({ kind: "game", id: "abc123" });
  });
  it("parses a claim route with seat + token", () => {
    expect(parseRoute("#/g/abc123/claim/2/tokenXYZ")).toEqual({
      kind: "claim", id: "abc123", seat: 2, token: "tokenXYZ",
    });
  });
  it("falls back to start on an unrecognized hash", () => {
    expect(parseRoute("#/nonsense")).toEqual({ kind: "start" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:run -- tests/app/router.test.ts`
Expected: FAIL — cannot resolve `parseRoute`.

- [ ] **Step 3: Implement the router**

Create `src/app/router.ts`:

```ts
export type Route =
  | { kind: "start" }
  | { kind: "game"; id: string }
  | { kind: "claim"; id: string; seat: number; token: string };

/** Pure parse of `location.hash` into a Route. Unknown shapes → start. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\//, ""); // "g/abc/claim/2/tok"
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "start" };
  if (parts[0] === "g" && parts.length === 2) return { kind: "game", id: parts[1]! };
  if (parts[0] === "g" && parts[2] === "claim" && parts.length === 5) {
    return { kind: "claim", id: parts[1]!, seat: Number(parts[3]), token: parts[4]! };
  }
  return { kind: "start" };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:run -- tests/app/router.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the online-create screen**

Create `src/app/CreateOnlineGame.tsx`:

```tsx
import { useState } from "react";
import { createGame } from "../net/game";
import type { SeatLink } from "../net/types";

const COLORS = ["red", "blue", "white", "orange"];
const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function CreateOnlineGame({ onBack }: { onBack: () => void }) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [mode, setMode] = useState<"beginner" | "random">("beginner");
  const [links, setLinks] = useState<SeatLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const players = Array.from({ length: count }, (_, i) => ({
        name: names[i]!.trim() || DEFAULT_NAMES[i]!, color: COLORS[i]!,
      }));
      const { links } = await createGame({ players, mode });
      setLinks(links);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the game");
    } finally { setBusy(false); }
  };

  if (links) {
    return (
      <div className="start-screen">
        <h1>Game created</h1>
        <p>Send each link to the right player. Each opens their seat.</p>
        <ul className="seat-links">
          {links.map((l) => (
            <li key={l.seat}>
              <span className="swatch" style={{ background: COLORS[l.seat] }} aria-hidden="true" />
              {names[l.seat]}: <input readOnly value={l.url} aria-label={`Seat ${l.seat + 1} link`}
                onFocus={(e) => e.currentTarget.select()} />
            </li>
          ))}
        </ul>
        <button onClick={onBack}>Done</button>
      </div>
    );
  }

  return (
    <div className="start-screen">
      <h1>New online game</h1>
      <label>Players:{" "}
        <select aria-label="Player count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="player-row">
          <span className="swatch" style={{ background: COLORS[i] }} aria-hidden="true" />
          <input aria-label={`Player ${i + 1} name`} value={names[i]}
            onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))} />
        </div>
      ))}
      <fieldset>
        <legend>Board</legend>
        <label><input type="radio" name="mode" checked={mode === "beginner"} onChange={() => setMode("beginner")} /> Beginner</label>
        <label><input type="radio" name="mode" checked={mode === "random"} onChange={() => setMode("random")} /> Random</label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create game"}</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
```

- [ ] **Step 6: Create the claim-seat screen**

Create `src/app/ClaimSeat.tsx`:

```tsx
import { useEffect, useState } from "react";
import { claimSeat } from "../net/game";

export function ClaimSeat({ id, seat, token, onClaimed }: {
  id: string; seat: number; token: string; onClaimed: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    claimSeat(id, seat, token)
      .then(() => onClaimed(id))
      .catch((e) => setError(e instanceof Error ? e.message : "This invite link is invalid."));
  }, [id, seat, token, onClaimed]);

  return (
    <main data-testid="app-root">
      <div className="start-screen">
        <h1>Joining game…</h1>
        {error && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Wire routing + online mode into `App.tsx`**

Replace `src/app/App.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { GameProvider } from "../state/GameProvider";
import { GameStore } from "../state/gameStore";
import { NetworkedGameStore } from "../state/NetworkedGameStore";
import { GameView } from "../ui/GameView";
import { StartScreen } from "./StartScreen";
import { CreateOnlineGame } from "./CreateOnlineGame";
import { ClaimSeat } from "./ClaimSeat";
import { LocalStoragePersistence } from "../state/persistence";
import { cryptoRng } from "../engine";
import type { Store } from "../state/store";
import { parseRoute, type Route } from "./router";
import { isFirebaseConfigured, makeRtdbBackend, seatForUid } from "../net/game-or-firebase";

const persistence = new LocalStoragePersistence();

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [store, setStore] = useState<Store | null>(null);
  const [resumable, setResumable] = useState<GameStore | null>(null);
  const [creatingOnline, setCreatingOnline] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    persistence.load().then((saved) => {
      if (saved) setResumable(new GameStore(saved, persistence, cryptoRng()));
      setChecked(true);
    });
  }, []);

  // Join an online game (claimed seat or already-bound device).
  const enterOnline = (id: string) => {
    void seatForUid(id).then((seat) => {
      setStore(new NetworkedGameStore(makeRtdbBackend(id), seat));
      location.hash = `#/g/${id}`;
    });
  };

  if (store) return <GameProvider store={store}><GameView /></GameProvider>;

  if (route.kind === "claim") {
    return <ClaimSeat id={route.id} seat={route.seat} token={route.token} onClaimed={enterOnline} />;
  }
  if (route.kind === "game") {
    enterOnline(route.id);
    return <main data-testid="app-root" />;
  }
  if (creatingOnline) {
    return <main data-testid="app-root"><CreateOnlineGame onBack={() => setCreatingOnline(false)} /></main>;
  }
  if (!checked) return <main data-testid="app-root" />;
  if (resumable) {
    return (
      <main data-testid="app-root">
        <div className="start-screen">
          <h1>Adulting Catan</h1>
          <button onClick={() => setStore(resumable)}>Resume game</button>
          <button onClick={() => { void persistence.clear(); setResumable(null); }}>New game</button>
        </div>
      </main>
    );
  }
  return (
    <main data-testid="app-root">
      <StartScreen onStart={setStore} onCreateOnline={isFirebaseConfigured() ? () => setCreatingOnline(true) : undefined} />
    </main>
  );
}
```

> **Engineer note:** `../net/game-or-firebase` does not exist — replace that import with two
> imports: `import { isFirebaseConfigured } from "../net/firebase";` and
> `import { makeRtdbBackend, seatForUid } from "../net/game";`. (Kept as one line here only
> for brevity; split it.)

- [ ] **Step 8: Add the "New online game" button to StartScreen**

Modify `src/app/StartScreen.tsx` — add an optional `onCreateOnline` prop and render a button when present. Change the signature and add the button just before the closing `</div>`:

```tsx
export function StartScreen({ onStart, onCreateOnline }: {
  onStart: (store: GameStore) => void;
  onCreateOnline?: () => void;
}) {
```

And before `</div>` (after the Start Game button):

```tsx
      {onCreateOnline && <button onClick={onCreateOnline}>New online game</button>}
```

- [ ] **Step 9: Add minimal styles for seat links**

Modify `src/ui/styles.css` — append:

```css
.seat-links { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.seat-links li { display: flex; align-items: center; gap: 0.5rem; }
.seat-links input { flex: 1; font-family: monospace; }
```

- [ ] **Step 10: Typecheck + run unit suite**

Run: `npm run typecheck && npm run test:run`
Expected: PASS (router tests included; existing UI tests unaffected — the StartScreen prop is optional).

- [ ] **Step 11: Commit**

```bash
git add src/app/router.ts src/app/CreateOnlineGame.tsx src/app/ClaimSeat.tsx src/app/App.tsx src/app/StartScreen.tsx src/ui/styles.css tests/app/router.test.ts
git commit -m "feat(app): hash routing, online-create + claim flows, mode select

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Deployment (GitHub Actions → Pages)

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (or create `docs/DEPLOY.md`)

- [ ] **Step 1: Create the Pages workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:run
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_DATABASE_URL: ${{ secrets.VITE_FIREBASE_DATABASE_URL }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Document the one-time setup**

Create `docs/DEPLOY.md`:

```markdown
# Deploying Adulting Catan

## One-time setup
1. **Firebase project** — create a free project; enable **Realtime Database** (locked mode)
   and **Anonymous** sign-in (Authentication → Sign-in method).
2. **Web config** — Project settings → Your apps → web app. Copy the values into:
   - local `.env` (see `.env.example`), and
   - GitHub repo → Settings → Secrets and variables → Actions → add each `VITE_FIREBASE_*`.
3. **Deploy security rules** — `npm i -D firebase-tools` then
   `npx firebase login` and `npm run rules:deploy` (uses `database.rules.json`).
4. **Enable Pages** — repo Settings → Pages → Source: **GitHub Actions**.

## Deploy
Push to `master`. The workflow runs tests, builds with the secrets, and publishes `dist/`.
Relative `base: "./"` means the project URL (`<user>.github.io/adultingcatan/`) just works.

## Local dev
`cp .env.example .env`, fill it in, `npm run dev`. Without `.env`, the app runs hotseat-only.
Run rules/adapter tests with the emulator: `npm run test:emulator`.
```

- [ ] **Step 3: Verify the production build succeeds locally**

Run: `npm run build`
Expected: `tsc --noEmit` passes and Vite writes `dist/`. (Build works without Firebase env;
the app simply hides online options at runtime.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml docs/DEPLOY.md
git commit -m "ci: GitHub Pages deploy workflow + deployment docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final full verification**

Run: `npm run typecheck && npm run test:run && npm run build`
Expected: all green. Then run the emulator suites once: `npm run test:emulator` → green.

---

## Self-Review Notes (coverage map)

- Spec §3 store seam → Task 1 (interface) + Task 2 (NetworkedGameStore).
- Spec §3 seed-injection → Task 2 Step 4 + test Step 2.
- Spec §4 Firebase data model → Task 3 (createGame writes state/meta/_claims).
- Spec §5 identity/claim → Task 3 (claimSeat/seatForUid) + Task 5 (ClaimSeat UI).
- Spec §6 security rules → Task 4.
- Spec §7 lobby/routing → Task 5.
- Spec §8 error handling → Task 2 (commit conflict), Task 3 (configured? fallback), Task 5 (claim error).
- Spec §9 testing → unit (Tasks 1,2,5) + emulator (Tasks 3,4).
- Spec §10 deployment → Task 6; note `base: "./"` already set, not `/adultingcatan/`.

**Known follow-ups (out of scope for this plan):** wiring the networked store's `seat()`
into `GameView`'s read-only / your-turn presentation is assumed already handled by the
existing `PassDeviceScreen`/turn logic reading `state.turn.activeSeat`; if the online UX
needs an explicit "not your turn" lock distinct from hotseat, add it as a Phase 3.1 task.
```

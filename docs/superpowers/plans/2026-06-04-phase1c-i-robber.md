# Robber, 7-Discard & Stealing Implementation Plan (Phase 1c-i)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "7" seam in the rules engine: rolling a 7 records discard obligations for over-limit players, then the active player moves the robber and steals a random card from an adjacent opponent.

**Architecture:** Pure additions to the existing `apply(state, action, rng)` engine. Per spec §6 (async model), a 7 does **not** stall the roller: it records top-level `discardObligations` for any player holding more than 7 cards and immediately moves the turn to a new `movingRobber` sub-phase. The active player resolves the robber (move + steal) which returns the turn to `main`. The `discard` action clears an obligation **independently** — it does not gate the roller's turn. Stealing draws through the injected `Rng`. Existing build/endTurn handlers gate on `subPhase === "main"`, so the *robber move* blocks the turn, but outstanding discards do not.

**Tech Stack:** TypeScript, Vitest. Pure engine code — no UI/network.

**Scope note:** This is the FIRST of several Phase 1c sub-plans. It covers ONLY the robber (7-discard obligations + move + steal). Out of scope here (later 1c sub-plans): development cards, trading, longest road, largest army. Reference spec: `docs/superpowers/specs/2026-06-03-catan-async-design.md` §6 (async 7-handling — discards don't block the roller) and §7 (robber on a 7).

---

## Context: the existing engine (Phase 1b, already merged to master)

Read these before starting; this plan extends them and must stay type-consistent:

- `src/engine/types.ts` — `GameState` (`version`, `phase`, `turn`, `board`, `players`, `bank`, `setup?`, `log`, `winner?`), `Turn` (`activeSeat`, `subPhase`, `dice?`, `setupSettlement?`), `SubPhase`, `Player`, `BoardState` (`buildings: Record<vertexId,{owner,type}>`, `robber: string`), `LogEntry`, the `Action` union. `ApplyResult = {ok:true,state} | {ok:false,error}`.
- `src/engine/apply.ts` — `apply()` does `structuredClone(state)` then `route(draft, action, rng)` returning `string | null` (error message or null), then `version += 1` and `checkVictory`. Add new action cases to `route`.
- `src/engine/actions/roll.ts` — `applyRollDice(state, rng)`. Currently on a 7 it does nothing (`// 7: robber/discard deferred to Phase 1c`). This is the seam we replace.
- `src/engine/resources.ts` — `ResourceMap = Record<Resource, number>`, `RESOURCE_LIST`, `emptyResources()`, `totalCards(map)`, `canAfford`, `payInto`, `gainInto`, `COSTS`.
- `src/engine/board.ts` — `topology()` (memoized `BoardTopology`: `hexIds`, `hexVertices: Map<hexId,vertexId[]>`, etc.).
- Test conventions (`tests/engine/roll.test.ts`): build a main-phase game with `createInitialGame(players3, createBoard({mode:"beginner"}))`, then set `phase="main"`, `turn={activeSeat:0, subPhase:"awaitingRoll"}`, `delete g.setup`. Inject a scripted `Rng` whose `nextInt` returns queued values. Dice come from `rng.nextInt(6)+1` (twice), so faces 3 & 4 (a 7) need `nextInt` to yield `2,3`.

### Environment
Windows; `node`/`npm`/`npx` on PATH in PowerShell and Bash. `npm run test:run` (all), `npm run typecheck` (tsc --noEmit), `npx vitest run <path>` (one file). Strict tsconfig incl. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` — **do not** write `victim: undefined` in an object literal for an optional `victim?: number` field; OMIT the key instead. Plain `git commit` works (no gpg). Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File structure

- Modify `src/engine/types.ts` — extend `SubPhase`, add top-level `GameState.discardObligations`, extend `LogEntry`, extend `Action`.
- Modify `src/engine/resources.ts` — add `DISCARD_LIMIT`.
- Modify `src/engine/actions/roll.ts` — replace the 7 seam: record obligations, go to `movingRobber`.
- Create `src/engine/actions/robber.ts` — `applyDiscard`, `applyMoveRobber` (+ private `stealRandom`).
- Modify `src/engine/apply.ts` — route `discard` and `moveRobber`.
- Modify `tests/engine/roll.test.ts` — update the one stale "7 → main" expectation.
- Create `tests/engine/robber.test.ts` — all new robber tests.

---

## Task 1: Rolling a 7 records discard obligations and enters the robber move

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/resources.ts`, `src/engine/actions/roll.ts`, `tests/engine/roll.test.ts`
- Create: `tests/engine/robber.test.ts`

- [ ] **Step 1: Update the stale existing test + write the new failing tests**

In `tests/engine/roll.test.ts`, the test `"a 7 produces nothing and continues the turn"` currently asserts the post-7 sub-phase is `"main"`. That behavior is changing. Replace that single `it(...)` block with:

```ts
  it("a 7 produces nothing and enters the robber move", () => {
    const { g } = setup();
    const r = apply(g, { type: "rollDice" }, scriptedRng(3, 4));
    expectOk(r);
    expect(r.state.turn.dice).toEqual([3, 4]);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    const total = r.state.players.reduce((s, p) => s + totalCards(p.resources), 0);
    expect(total).toBe(0);
  });
```

Create `tests/engine/robber.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

/** Rng whose nextInt returns queued RAW values (not die faces). */
function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}

/** dice faces 3 & 4 (sum 7): roll does nextInt(6)+1, so feed 2,3. */
function sevenRng(): Rng {
  return rngOf(2, 3);
}

function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "awaitingRoll" };
  delete g.setup;
  return g;
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("rolling a 7 -> robber move", () => {
  it("with no one over 7 cards: no obligations, goes to movingRobber, produces nothing", () => {
    const g = mainGame();
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toBeUndefined();
  });

  it("a player holding more than 7 cards owes floor(half) but the roller still moves on", () => {
    const g = mainGame();
    g.players[1]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber"); // NOT blocked by the discard
    expect(r.state.discardObligations).toEqual({ 1: 4 });
  });

  it("exactly 7 cards owes nothing", () => {
    const g = mainGame();
    g.players[1]!.resources = { wood: 7, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/robber.test.ts tests/engine/roll.test.ts`
Expected: FAIL — `discardObligations`/`movingRobber` don't exist yet (type errors / wrong sub-phase).

- [ ] **Step 3: Implement the type + rule changes**

In `src/engine/types.ts`, extend `SubPhase` (add ONLY `movingRobber`) and add a top-level `discardObligations` field to `GameState`:

```ts
export type SubPhase =
  | "setupSettlement" | "setupRoad" | "awaitingRoll" | "main"
  | "movingRobber";
```

```ts
export interface GameState {
  version: number;
  phase: Phase;
  turn: Turn;
  board: BoardState;
  players: Player[];
  bank: ResourceMap;
  setup?: { order: number[]; pos: number };
  discardObligations?: Record<number, number>; // seat -> cards still owed after a 7
  log: LogEntry[];
  winner?: number;
}
```

(Leave `Turn` unchanged. Obligations are top-level so they survive `endTurn` resetting `turn`.)

In `src/engine/resources.ts`, add below `COSTS`:

```ts
/** Players holding MORE than this many cards must discard half (floor) on a 7. */
export const DISCARD_LIMIT = 7;
```

In `src/engine/actions/roll.ts`, update the imports and replace the 7 seam. The full file becomes:

```ts
import type { GameState, Resource } from "../types";
import type { Rng } from "../rng";
import { topology } from "../board";
import {
  RESOURCE_LIST, emptyResources, totalCards, DISCARD_LIMIT, type ResourceMap,
} from "../resources";

export function applyRollDice(state: GameState, rng: Rng): string | null {
  if (state.turn.subPhase !== "awaitingRoll") return "Not awaiting a dice roll";
  const d1 = rng.nextInt(6) + 1;
  const d2 = rng.nextInt(6) + 1;
  const sum = d1 + d2;
  state.turn.dice = [d1, d2];
  state.log.push({ type: "roll", seat: state.turn.activeSeat, dice: [d1, d2], sum });

  if (sum === 7) {
    const owed: Record<number, number> = {};
    for (const p of state.players) {
      const total = totalCards(p.resources);
      if (total > DISCARD_LIMIT) owed[p.seat] = Math.floor(total / 2);
    }
    if (Object.keys(owed).length > 0) state.discardObligations = owed;
    state.turn.subPhase = "movingRobber"; // roller proceeds; discards don't block
    return null;
  }

  state.turn.subPhase = "main";
  produce(state, sum);
  return null;
}

function produce(state: GameState, sum: number): void {
  const owed: ResourceMap[] = state.players.map(() => emptyResources());
  for (const hid of topology().hexIds) {
    const tile = state.board.tiles[hid]!;
    if (tile.number !== sum) continue;
    if (hid === state.board.robber) continue;
    if (tile.kind === "desert") continue;
    const res: Resource = tile.kind;
    for (const v of topology().hexVertices.get(hid) ?? []) {
      const b = state.board.buildings[v];
      if (!b) continue;
      owed[b.owner]![res] += b.type === "city" ? 2 : 1;
    }
  }

  for (const res of RESOURCE_LIST) {
    const demand = owed.reduce((s, o) => s + o[res], 0);
    if (demand === 0) continue;
    if (state.bank[res] >= demand) {
      for (let seat = 0; seat < owed.length; seat++) {
        const amt = owed[seat]![res];
        if (amt === 0) continue;
        state.players[seat]!.resources[res] += amt;
        state.bank[res] -= amt;
      }
    } else {
      const claimants = owed.filter((o) => o[res] > 0).length;
      if (claimants === 1) {
        const seat = owed.findIndex((o) => o[res] > 0);
        const give = Math.min(owed[seat]![res], state.bank[res]);
        state.players[seat]!.resources[res] += give;
        state.bank[res] -= give;
      }
      // multiple claimants + insufficient bank: nobody gets this resource
    }
  }
}
```

(Only the imports and the `sum === 7` branch changed; `produce` is unchanged from Phase 1b — reproduced in full so the file is complete.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/robber.test.ts tests/engine/roll.test.ts`
Expected: PASS (3 robber tests + the updated roll suite).

- [ ] **Step 5: Commit**

```
git add src/engine/types.ts src/engine/resources.ts src/engine/actions/roll.ts tests/engine/roll.test.ts tests/engine/robber.test.ts
git commit -m "feat(engine): rolling a 7 records discard obligations and moves to robber

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: The discard action (independent obligation, non-blocking)

**Files:**
- Modify: `src/engine/types.ts` (Action + LogEntry), `src/engine/apply.ts` (route)
- Create: `src/engine/actions/robber.ts`
- Test: append to `tests/engine/robber.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/engine/robber.test.ts`:

```ts
describe("discard action", () => {
  function rolled7WithOverflow(): GameState {
    const g = mainGame();
    g.players[1]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    g.bank.wood = 19 - 8; // pretend the 8 came from the bank, so totals stay sane
    const r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.discardObligations).toEqual({ 1: 4 });
    return r.state;
  }

  it("a valid discard returns cards to the bank and clears the obligation (turn unchanged)", () => {
    const s = rolled7WithOverflow();
    const before = s.bank.wood;
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expectOk(r);
    expect(r.state.players[1]!.resources.wood).toBe(4);
    expect(r.state.bank.wood).toBe(before + 4);
    expect(r.state.discardObligations).toBeUndefined();
    expect(r.state.turn.subPhase).toBe("movingRobber"); // discard does NOT move the robber
  });

  it("rejects a discard of the wrong count", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a discard from a player who owes nothing", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 0, cards: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects discarding cards the player does not have", () => {
    const s = rolled7WithOverflow();
    const r = apply(
      s,
      { type: "discard", seat: 1, cards: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 4 } },
      rngOf(),
    );
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/robber.test.ts`
Expected: FAIL — `discard` action type/handler doesn't exist.

- [ ] **Step 3: Implement**

In `src/engine/types.ts`, add `"discard"` to the `LogEntry.type` union and a `count?: number` field, and add the `discard` variant to `Action`:

```ts
export interface LogEntry {
  type:
    | "setupSettlement" | "setupRoad"
    | "roll" | "buildRoad" | "buildSettlement" | "buildCity"
    | "endTurn" | "win"
    | "discard";
  seat: number;
  vertex?: string;
  edge?: string;
  dice?: [number, number];
  sum?: number;
  count?: number;
}
```

```ts
export type Action =
  | { type: "setupSettlement"; vertex: string }
  | { type: "setupRoad"; edge: string }
  | { type: "rollDice" }
  | { type: "buildRoad"; edge: string }
  | { type: "buildSettlement"; vertex: string }
  | { type: "buildCity"; vertex: string }
  | { type: "endTurn" }
  | { type: "discard"; seat: number; cards: ResourceMap };
```

Create `src/engine/actions/robber.ts` (the discard handler checks the top-level obligation, NOT the sub-phase, so a player may pay their debt at any time):

```ts
import type { GameState } from "../types";
import { RESOURCE_LIST, type ResourceMap } from "../resources";

export function applyDiscard(state: GameState, seat: number, cards: ResourceMap): string | null {
  const owed = state.discardObligations?.[seat] ?? 0;
  if (owed <= 0) return "You do not owe a discard";
  const player = state.players[seat];
  if (!player) return "Unknown player";

  let sum = 0;
  for (const res of RESOURCE_LIST) {
    const n = cards[res];
    if (n < 0) return "Discard amounts cannot be negative";
    if (n > player.resources[res]) return "Cannot discard cards you do not have";
    sum += n;
  }
  if (sum !== owed) return `You must discard exactly ${owed} card(s)`;

  for (const res of RESOURCE_LIST) {
    player.resources[res] -= cards[res];
    state.bank[res] += cards[res];
  }
  state.log.push({ type: "discard", seat, count: owed });

  delete state.discardObligations![seat];
  if (Object.keys(state.discardObligations!).length === 0) {
    delete state.discardObligations;
  }
  return null;
}
```

In `src/engine/apply.ts`, import and route it:

```ts
import { applyDiscard } from "./actions/robber";
```

Add inside `route`'s `switch`, before the `endTurn` case:

```ts
    case "discard":
      return applyDiscard(draft, action.seat, action.cards);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/robber.test.ts`
Expected: PASS (all discard tests + Task 1 tests).

- [ ] **Step 5: Commit**

```
git add src/engine/types.ts src/engine/apply.ts src/engine/actions/robber.ts tests/engine/robber.test.ts
git commit -m "feat(engine): independent discard action for the 7-discard obligation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: The moveRobber action + stealing

**Files:**
- Modify: `src/engine/types.ts` (Action + LogEntry), `src/engine/apply.ts` (route), `src/engine/actions/robber.ts` (add handler + steal helper)
- Test: append to `tests/engine/robber.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/engine/robber.test.ts`:

```ts
describe("moveRobber + steal", () => {
  function movingRobberState(): { s: GameState; targetHex: string } {
    const g = mainGame();
    const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
    const victimVertex = topology().hexVertices.get(targetHex)![0]!;
    g.board.buildings[victimVertex] = { owner: 1, type: "settlement" };
    g.players[1]!.resources = { wood: 1, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    g.turn.subPhase = "movingRobber";
    return { s: g, targetHex };
  }

  it("moves the robber, steals one random card, and returns to main", () => {
    const { s, targetHex } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: targetHex, victim: 1 }, rngOf(0));
    expectOk(r);
    expect(r.state.board.robber).toBe(targetHex);
    expect(r.state.players[1]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.wood).toBe(1);
    expect(r.state.turn.subPhase).toBe("main");
  });

  it("rejects moving the robber to its current hex", () => {
    const { s } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: s.board.robber }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("requires choosing a victim when an eligible target exists", () => {
    const { s, targetHex } = movingRobberState();
    const r = apply(s, { type: "moveRobber", hex: targetHex }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("moves with no steal when no adjacent opponent has cards", () => {
    const g = mainGame();
    const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
    g.turn.subPhase = "movingRobber";
    const r = apply(g, { type: "moveRobber", hex: targetHex }, rngOf());
    expectOk(r);
    expect(r.state.board.robber).toBe(targetHex);
    expect(r.state.turn.subPhase).toBe("main");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/robber.test.ts`
Expected: FAIL — `moveRobber` action type/handler doesn't exist.

- [ ] **Step 3: Implement**

In `src/engine/types.ts`, extend `LogEntry` (add `"moveRobber" | "steal"` to the type union and the fields `hex?`, `victim?`, `resource?`) and add the `moveRobber` action:

```ts
export interface LogEntry {
  type:
    | "setupSettlement" | "setupRoad"
    | "roll" | "buildRoad" | "buildSettlement" | "buildCity"
    | "endTurn" | "win"
    | "discard" | "moveRobber" | "steal";
  seat: number;
  vertex?: string;
  edge?: string;
  dice?: [number, number];
  sum?: number;
  count?: number;
  hex?: string;
  victim?: number;
  resource?: Resource;
}
```

```ts
export type Action =
  | { type: "setupSettlement"; vertex: string }
  | { type: "setupRoad"; edge: string }
  | { type: "rollDice" }
  | { type: "buildRoad"; edge: string }
  | { type: "buildSettlement"; vertex: string }
  | { type: "buildCity"; vertex: string }
  | { type: "endTurn" }
  | { type: "discard"; seat: number; cards: ResourceMap }
  | { type: "moveRobber"; hex: string; victim?: number };
```

(`Resource` is already imported at the top of `types.ts`.)

In `src/engine/actions/robber.ts`, replace the existing first import line with these four lines (so the new handler can reach `topology`, `totalCards`, `Rng`, and `Resource`; `applyDiscard` still compiles — it only uses `GameState`, `RESOURCE_LIST`, and `ResourceMap`):

```ts
import type { GameState, Resource } from "../types";
import type { Rng } from "../rng";
import { topology } from "../board";
import { RESOURCE_LIST, totalCards, type ResourceMap } from "../resources";
```

Then append the handler + helper to `src/engine/actions/robber.ts`:

```ts
function stealRandom(state: GameState, fromSeat: number, toSeat: number, rng: Rng): Resource | null {
  const victim = state.players[fromSeat]!;
  const pool: Resource[] = [];
  for (const res of RESOURCE_LIST) {
    for (let i = 0; i < victim.resources[res]; i++) pool.push(res);
  }
  if (pool.length === 0) return null;
  const res = pool[rng.nextInt(pool.length)]!;
  victim.resources[res] -= 1;
  state.players[toSeat]!.resources[res] += 1;
  return res;
}

export function applyMoveRobber(
  state: GameState,
  hex: string,
  victim: number | undefined,
  rng: Rng,
): string | null {
  if (state.turn.subPhase !== "movingRobber") return "Not time to move the robber";
  if (!topology().hexIds.includes(hex)) return "Unknown hex";
  if (hex === state.board.robber) return "The robber must move to a different hex";

  const active = state.turn.activeSeat;
  const owners = new Set<number>();
  for (const v of topology().hexVertices.get(hex) ?? []) {
    const b = state.board.buildings[v];
    if (b && b.owner !== active) owners.add(b.owner);
  }
  const eligible = [...owners].filter((s) => totalCards(state.players[s]!.resources) > 0);

  if (victim !== undefined) {
    if (!eligible.includes(victim)) {
      return "You can only steal from a player with a building on that hex who holds cards";
    }
  } else if (eligible.length > 0) {
    return "You must choose a player to steal from";
  }

  state.board.robber = hex;
  state.log.push({ type: "moveRobber", seat: active, hex });
  if (victim !== undefined) {
    const res = stealRandom(state, victim, active, rng);
    if (res !== null) state.log.push({ type: "steal", seat: active, victim, resource: res });
  }
  state.turn.subPhase = "main";
  return null;
}
```

In `src/engine/apply.ts`, extend the import and add the route case:

```ts
import { applyDiscard, applyMoveRobber } from "./actions/robber";
```

```ts
    case "moveRobber":
      return applyMoveRobber(draft, action.hex, action.victim, rng);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/robber.test.ts`
Expected: PASS (all robber tests).

- [ ] **Step 5: Commit**

```
git add src/engine/types.ts src/engine/apply.ts src/engine/actions/robber.ts tests/engine/robber.test.ts
git commit -m "feat(engine): move robber and steal a random card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full 7 → move/steal → discard scenario + suite gate

**Files:**
- Test: append to `tests/engine/robber.test.ts`

- [ ] **Step 1: Write the failing scenario tests** — append to `tests/engine/robber.test.ts`:

```ts
describe("full 7 flow", () => {
  it("the roller moves the robber and steals while still owing a discard, then discards", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 8, brick: 0, sheep: 0, wheat: 0, ore: 0 }; // roller owes 4
    g.bank.wood = 19 - 8;
    const targetHex = topology().hexIds.find((h) => h !== g.board.robber)!;
    const victimVertex = topology().hexVertices.get(targetHex)![0]!;
    g.board.buildings[victimVertex] = { owner: 1, type: "settlement" };
    g.players[1]!.resources = { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 };

    let r = apply(g, { type: "rollDice" }, sevenRng());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.discardObligations).toEqual({ 0: 4 });

    // roller resolves the robber immediately (does NOT have to discard first)
    r = apply(r.state, { type: "moveRobber", hex: targetHex, victim: 1 }, rngOf(0));
    expectOk(r);
    expect(r.state.board.robber).toBe(targetHex);
    expect(r.state.players[1]!.resources.brick).toBe(1);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.turn.subPhase).toBe("main");
    expect(r.state.discardObligations).toEqual({ 0: 4 }); // still owed

    // roller pays the discard
    r = apply(
      r.state,
      { type: "discard", seat: 0, cards: { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 } },
      rngOf(),
    );
    expectOk(r);
    expect(r.state.discardObligations).toBeUndefined();

    const end = apply(r.state, { type: "endTurn" }, rngOf());
    expectOk(end);
    expect(end.state.turn.activeSeat).toBe(1);
  });

  it("blocks ending the turn until the robber is moved", () => {
    const g = mainGame();
    const r = apply(g, { type: "rollDice" }, sevenRng()); // 0 cards -> movingRobber
    expectOk(r);
    const blocked = apply(r.state, { type: "endTurn" }, rngOf());
    expect(blocked.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify** (these should PASS immediately — the behavior exists from Tasks 1-3; this task is the end-to-end safety net)

Run: `npx vitest run tests/engine/robber.test.ts`
Expected: PASS. If anything fails, the bug is real — fix the implementation, not the test.

- [ ] **Step 3: Run the FULL suite + typecheck (milestone gate)**

Run: `npm run test:run`
Expected: all files pass (board, engine, robber, smoke). Test count should be the prior 72 plus the new robber tests.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add tests/engine/robber.test.ts
git commit -m "test(engine): end-to-end 7/robber flow scenario

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- Rolling a 7 no longer produces resources; it records top-level `discardObligations` for players holding >7 cards (discard = floor(total/2)) and moves the turn to `movingRobber`. The roller is **not** blocked by outstanding discards.
- `discard` validates count/ownership against a seat's obligation, returns the cards to the bank, and clears the obligation — at any time, without changing the sub-phase.
- `moveRobber` validates the destination and victim, moves the robber, steals one random card (via injected `Rng`) from an adjacent opponent who holds cards, and returns the turn to `main`.
- The *robber move* gates the turn (build/`endTurn` need `subPhase === "main"`), but discards do not.
- `npm run test:run` and `npm run typecheck` both green.

## Remaining Phase 1c sub-plans (not in this plan)

1. **Development cards** — buy + the 5 card types (knight, road building, year of plenty, monopoly, VP) with one-per-turn / not-same-turn timing, and **Largest Army** (≥3 knights).
2. **Trading** — bank 4:1, port 3:1/2:1, and async player trade offers (propose/accept/cancel).
3. **Longest Road** — ≥5 with break detection, plus integrating both awards into the victory check.

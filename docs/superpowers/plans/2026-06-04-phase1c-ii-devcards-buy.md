# Development Cards: Deck, Buying & Victory-Point Cards (Phase 1c-ii)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the development-card deck, the `buyDevCard` action (cost + random draw), and make hidden Victory-Point cards count toward the 10-VP win.

**Architecture:** Pure additions to the `apply(state, action, rng)` engine. The full 25-card deck lives on `GameState.devDeck`; buying draws a random card by index via the injected `Rng` (no pre-shuffle needed, since `createInitialGame` has no rng). Each player holds bought cards in `player.devCards` with a `boughtThisTurn` flag (used by later plans to enforce the not-same-turn rule). VP cards are never "played" — they raise the owner's `victoryPoints` immediately (hidden in the log).

**Tech Stack:** TypeScript, Vitest. Pure engine — no UI/network.

**Scope note:** Part of Phase 1c. This plan covers ONLY the deck, buying, and VP cards. Out of scope here (later sub-plans): playing monopoly / year-of-plenty / road-building (1c-iii), and knight + Largest Army (1c-iv). Reference spec: `docs/superpowers/specs/2026-06-03-catan-async-design.md` §7 (full dev-card deck; one-per-turn / not-same-turn timing — the timing rules land with the playable cards in 1c-iii).

---

## Context: existing engine (on master)

- `src/engine/types.ts`: `GameState` { version, phase, turn, board, players, bank, setup?, discardObligations?, log, winner? }; `Player` { seat, name, color, resources: ResourceMap, victoryPoints, pieces }; `Turn` { activeSeat, subPhase, dice?, setupSettlement? }; `Action` union; `LogEntry`. `Resource`/`ResourceMap` imported/exported here.
- `src/engine/apply.ts`: `route(draft, action, rng)` switch returning `string | null`; calls `checkVictory(draft)` after every action.
- `src/engine/resources.ts`: `ResourceMap`, `RESOURCE_LIST`, `canAfford(have,cost)`, `payInto`, `COSTS`, `emptyResources`, `fullBank`.
- `src/engine/state.ts`: `createInitialGame(players: NewPlayer[], board): GameState` — constructs players (`resources: emptyResources()`, `victoryPoints: 0`, `pieces: {roads:15,settlements:5,cities:4}`) and the initial state. NO rng param.
- `src/engine/scoring/victory.ts`: `victoryPointsFromBuildings(state, seat)`, `recomputeVictoryPoints(state, seat)` (currently sets `player.victoryPoints = buildings only`), `checkVictory(state)` (first player ≥10 VP → `phase="finished"`, `winner`).
- `src/engine/actions/build.ts`: build handlers call `recomputeVictoryPoints` after building; they gate on `phase==="main" && subPhase==="main"`.

### Environment
Windows; `node`/`npm`/`npx` on PATH (PowerShell + Bash). `npm run test:run`, `npm run typecheck`, `npx vitest run <path>`. Strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Plain `git commit` works. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Make surgical edits to existing files.

---

## File structure
- Create `src/engine/devcards.ts` — `DevCardType`, `makeDevDeck()`, `DEV_CARD_COST`.
- Modify `src/engine/types.ts` — `PlayerDevCard`, `Player.devCards`, `GameState.devDeck`, `Action` + `LogEntry`.
- Modify `src/engine/state.ts` — seed `devDeck` and players' `devCards`.
- Create `src/engine/actions/dev.ts` — `applyBuyDevCard`.
- Modify `src/engine/apply.ts` — route `buyDevCard`.
- Modify `src/engine/scoring/victory.ts` — count VP cards in `recomputeVictoryPoints`.
- Create `tests/engine/devcards.test.ts`.

---

## Task 1: Dev-card types and the deck

**Files:**
- Create: `src/engine/devcards.ts`
- Modify: `src/engine/types.ts`, `src/engine/state.ts`
- Test: `tests/engine/devcards.test.ts`

- [ ] **Step 1: Write the failing test** `tests/engine/devcards.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { makeDevDeck } from "../../src/engine/devcards";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

describe("dev deck", () => {
  it("makeDevDeck has the 25 standard cards", () => {
    const deck = makeDevDeck();
    expect(deck).toHaveLength(25);
    const count = (t: string) => deck.filter((c) => c === t).length;
    expect(count("knight")).toBe(14);
    expect(count("victoryPoint")).toBe(5);
    expect(count("roadBuilding")).toBe(2);
    expect(count("yearOfPlenty")).toBe(2);
    expect(count("monopoly")).toBe(2);
  });

  it("a new game seeds the deck and gives every player an empty dev-card hand", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
    expect(g.devDeck).toHaveLength(25);
    for (const p of g.players) expect(p.devCards).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: FAIL — `makeDevDeck`/`devDeck`/`devCards` don't exist.

- [ ] **Step 3: Implement**

Create `src/engine/devcards.ts`:
```ts
import type { ResourceMap } from "./resources";

export type DevCardType =
  | "knight" | "roadBuilding" | "yearOfPlenty" | "monopoly" | "victoryPoint";

/** Standard base-game development deck (25 cards). */
export function makeDevDeck(): DevCardType[] {
  const deck: DevCardType[] = [];
  for (let i = 0; i < 14; i++) deck.push("knight");
  for (let i = 0; i < 5; i++) deck.push("victoryPoint");
  for (let i = 0; i < 2; i++) deck.push("roadBuilding");
  for (let i = 0; i < 2; i++) deck.push("yearOfPlenty");
  for (let i = 0; i < 2; i++) deck.push("monopoly");
  return deck;
}

export const DEV_CARD_COST: ResourceMap = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
```

In `src/engine/types.ts`:
- Add an import near the top: `import type { DevCardType } from "./devcards";`
- Add this interface (e.g. above `Player`):
```ts
export interface PlayerDevCard {
  type: DevCardType;
  boughtThisTurn: boolean;
  played: boolean;
}
```
- Add `devCards: PlayerDevCard[];` to the `Player` interface.
- Add `devDeck: DevCardType[];` to the `GameState` interface (e.g. after `bank`).

In `src/engine/state.ts`:
- Add an import: `import { makeDevDeck } from "./devcards";`
- In the `players.map(...)` player object, add `devCards: [],`.
- In the returned `GameState` object literal, add `devDeck: makeDevDeck(),` (e.g. after `bank`).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: PASS (2 tests).
Then `npm run test:run` (all green — confirm the new required fields didn't break other tests; they shouldn't, since every game is built via `createInitialGame`) and `npm run typecheck` (exit 0).

- [ ] **Step 5: Commit**
```
git add src/engine/devcards.ts src/engine/types.ts src/engine/state.ts tests/engine/devcards.test.ts
git commit -m "feat(engine): development-card deck and player dev-card hands

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: The buyDevCard action

**Files:**
- Modify: `src/engine/types.ts` (Action + LogEntry), `src/engine/apply.ts` (route)
- Create: `src/engine/actions/dev.ts`
- Test: append to `tests/engine/devcards.test.ts`

- [ ] **Step 1: Write the failing tests** — add the three `import` lines below to the TOP of `tests/engine/devcards.test.ts` (alongside the existing imports), and append the helpers + `describe` block to the end of the file:

```ts
import { apply } from "../../src/engine/apply";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}

function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main";
  g.turn = { activeSeat: 0, subPhase: "main" };
  delete g.setup;
  return g;
}

function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("buyDevCard", () => {
  it("pays ore+wheat+sheep, draws one card, and shrinks the deck", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(r);
    expect(r.state.players[0]!.devCards).toHaveLength(1);
    expect(r.state.players[0]!.devCards[0]!.boughtThisTurn).toBe(true);
    expect(r.state.devDeck).toHaveLength(24);
    expect(r.state.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    expect(r.state.bank.sheep).toBe(20); // bank started at 19, +1 returned
  });

  it("rejects buying without enough resources", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 1 };
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });

  it("rejects buying when the deck is empty", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = [];
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });

  it("rejects buying before rolling (not main sub-phase)", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.turn.subPhase = "awaitingRoll";
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: FAIL — `buyDevCard` action/handler doesn't exist.

- [ ] **Step 3: Implement**

In `src/engine/types.ts`:
- Add `"buyDevCard"` to the `LogEntry.type` string union.
- Add to the `Action` union: `| { type: "buyDevCard" }`.

Create `src/engine/actions/dev.ts`:
```ts
import type { GameState } from "../types";
import type { Rng } from "../rng";
import { canAfford, payInto, RESOURCE_LIST } from "../resources";
import { DEV_CARD_COST } from "../devcards";
import { recomputeVictoryPoints } from "../scoring/victory";

function requireMain(state: GameState): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  return null;
}

export function applyBuyDevCard(state: GameState, rng: Rng): string | null {
  const err = requireMain(state);
  if (err) return err;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  if (state.devDeck.length === 0) return "The development deck is empty";
  if (!canAfford(player.resources, DEV_CARD_COST)) return "Not enough resources for a development card";

  payInto(player.resources, DEV_CARD_COST);
  for (const k of RESOURCE_LIST) state.bank[k] += DEV_CARD_COST[k];

  const i = rng.nextInt(state.devDeck.length);
  const card = state.devDeck.splice(i, 1)[0]!;
  player.devCards.push({ type: card, boughtThisTurn: true, played: false });

  if (card === "victoryPoint") recomputeVictoryPoints(state, seat);
  state.log.push({ type: "buyDevCard", seat });
  return null;
}
```

In `src/engine/apply.ts`: add `import { applyBuyDevCard } from "./actions/dev";` and add to `route`'s switch (before `endTurn`):
```ts
    case "buyDevCard":
      return applyBuyDevCard(draft, rng);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: PASS.
Then `npm run test:run` (all green) and `npm run typecheck` (exit 0).

- [ ] **Step 5: Commit**
```
git add src/engine/types.ts src/engine/apply.ts src/engine/actions/dev.ts tests/engine/devcards.test.ts
git commit -m "feat(engine): buy development card (cost + random draw)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Victory-Point cards count toward the win

**Files:**
- Modify: `src/engine/scoring/victory.ts`
- Test: append to `tests/engine/devcards.test.ts`

- [ ] **Step 1: Write the failing tests** — append this `describe` block to `tests/engine/devcards.test.ts`, and add the two new import lines at the TOP of the file (alongside the existing imports):

New imports to add at the top of the file:
```ts
import { recomputeVictoryPoints } from "../../src/engine/scoring/victory";
import { topology } from "../../src/engine/board";
```

New describe block to append at the end:
```ts
describe("victory-point dev cards", () => {
  it("a held VP card adds 1 to recomputed victory points", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "victoryPoint", boughtThisTurn: true, played: false });
    recomputeVictoryPoints(g, 0);
    expect(g.players[0]!.victoryPoints).toBe(1); // 0 buildings + 1 VP card
  });

  it("buying the final VP card wins the game at 9 building VP", () => {
    const g = mainGame();
    // 9 VP of buildings placed directly (bypassing distance/network — fine for a scoring test):
    // 4 cities (8) + 1 settlement (1).
    const verts = topology().vertexIds.slice(0, 5);
    verts.slice(0, 4).forEach((v) => (g.board.buildings[v] = { owner: 0, type: "city" }));
    g.board.buildings[verts[4]!] = { owner: 0, type: "settlement" };
    recomputeVictoryPoints(g, 0);
    expect(g.players[0]!.victoryPoints).toBe(9);

    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = ["victoryPoint"];
    const r = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(r);
    expect(r.state.players[0]!.victoryPoints).toBe(10);
    expect(r.state.phase).toBe("finished");
    expect(r.state.winner).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: FAIL — the held VP card is not yet counted by `recomputeVictoryPoints` (the first test expects 1 but gets 0).

- [ ] **Step 3: Implement** — update `recomputeVictoryPoints` in `src/engine/scoring/victory.ts`:

```ts
export function recomputeVictoryPoints(state: GameState, seat: number): void {
  const player = state.players[seat]!;
  let vp = victoryPointsFromBuildings(state, seat);
  for (const c of player.devCards) {
    if (c.type === "victoryPoint") vp += 1;
  }
  player.victoryPoints = vp;
}
```

(`victoryPointsFromBuildings` and `checkVictory` stay unchanged. `buyDevCard` already calls `recomputeVictoryPoints` when a VP card is drawn, and `apply` runs `checkVictory` afterward, so the win triggers.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/engine/devcards.test.ts`
Expected: PASS.
Then `npm run test:run` (all green) and `npm run typecheck` (exit 0).

- [ ] **Step 5: Commit**
```
git add src/engine/scoring/victory.ts tests/engine/devcards.test.ts
git commit -m "feat(engine): victory-point dev cards count toward the win

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Suite gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite + typecheck**

Run: `npm run test:run`
Expected: all test files pass (board, engine incl. devcards, smoke). Count = the prior 85 plus the new devcards tests.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 2: If anything is red, fix the implementation** (not the tests) until green, then re-run.

- [ ] **Step 3: Commit** (only if Step 2 changed anything; otherwise skip — Tasks 1-3 already committed the work)

```
git add -A
git commit -m "test(engine): dev-card buy/VP suite gate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria
- `makeDevDeck()` returns the 25-card base deck; `createInitialGame` seeds `GameState.devDeck` and gives each player an empty `devCards` hand.
- `buyDevCard` requires the main sub-phase, costs 1 ore + 1 wheat + 1 sheep (returned to the bank), draws a random card via the injected `Rng`, and tags it `boughtThisTurn`.
- A held Victory-Point card adds 1 to recomputed victory points; drawing one that reaches 10 ends the game.
- `npm run test:run` and `npm run typecheck` both green.

## Remaining dev-card work (later sub-plans)
- **1c-iii:** play monopoly / year-of-plenty / road-building, plus the one-per-turn and not-same-turn-bought timing rules (and clearing `boughtThisTurn` on `endTurn`).
- **1c-iv:** knight (reuses the robber move) + Largest Army (≥3 knights, +2 VP, steal-on-exceed), wired into `recomputeVictoryPoints`.

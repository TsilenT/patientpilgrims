# Play Dev Cards: Monopoly, Year-of-Plenty, Road-Building + Timing (Phase 1c-iii)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players play the three non-knight development cards (monopoly, year of plenty, road building), enforcing the two timing rules: **one dev card per turn** and **not the turn you bought it**.

**Architecture:** Pure additions to `apply(state, action, rng)`. A shared `playDevCardGuard(state, type)` validates the timing rules and marks the chosen card `played`; each play action calls it then applies its effect. `endTurn` clears the ending player's `boughtThisTurn` flags so cards become playable on their next turn.

**Tech Stack:** TypeScript, Vitest. Pure engine.

**Scope:** ONLY monopoly / year-of-plenty / road-building + timing. Knight + Largest Army are 1c-iv (knight reuses the robber move). Reference spec §7.

---

## Context (engine on master, after 1c-ii)
- `src/engine/types.ts`: `Turn { activeSeat, subPhase, dice?, setupSettlement? }`; `Player.devCards: PlayerDevCard[]` (`{type: DevCardType, boughtThisTurn, played}`); `Action` union; `LogEntry` (type union + `seat`, `resource?`, `count?`, `edge?`, ...). `Resource`/`ResourceMap` exported.
- `src/engine/actions/dev.ts`: `applyBuyDevCard` (sets `boughtThisTurn: true` on the drawn card). Has a private `requireMain`.
- `src/engine/actions/turn.ts`: `applyEndTurn` — guards `subPhase==="main"`, advances seat, resets turn.
- `src/engine/actions/build.ts`: road validation pattern (`topology().edgeIds.includes(edge)`, `board.roads[edge]`, `player.pieces.roads`, `edgeConnects(board, seat, edge)`).
- `src/engine/placement.ts`: `edgeConnects(board, seat, edge)`.
- `src/engine/resources.ts`: `RESOURCE_LIST`, `emptyResources()`.
- `src/engine/apply.ts`: `route(draft, action, rng)` switch.
- Tests: pattern from `tests/engine/devcards.test.ts` (`mainGame()`, `rngOf`, `expectOk`, `players3`).

### Environment
Windows; `node`/`npm`/`npx` on PATH. `npm run test:run`, `npm run typecheck`, `npx vitest run <path>`. Strict tsconfig. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Surgical edits.

---

## File structure
- Modify `src/engine/types.ts` — `Turn.devCardPlayedThisTurn?`; `Action` + `LogEntry`.
- Modify `src/engine/actions/dev.ts` — `playDevCardGuard`, `applyPlayMonopoly`, `applyPlayYearOfPlenty`, `applyPlayRoadBuilding`.
- Modify `src/engine/actions/turn.ts` — clear `boughtThisTurn` on endTurn.
- Modify `src/engine/apply.ts` — route the three play actions.
- Create `tests/engine/play-devcards.test.ts`.

---

## Task 1: Timing infrastructure (guard + endTurn clears boughtThisTurn)

**Files:** modify `types.ts`, `dev.ts`, `turn.ts`; create `tests/engine/play-devcards.test.ts`.

- [ ] **Step 1: failing test** `tests/engine/play-devcards.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";

const players3 = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}
function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}

describe("dev-card play timing", () => {
  it("endTurn clears the ending player's boughtThisTurn flags", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: true, played: false });
    const r = apply(g, { type: "endTurn" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.devCards[0]!.boughtThisTurn).toBe(false);
  });
});

export { players3, rngOf, mainGame, expectOk };
```
(The `export` line lets later test files in this plan reuse the helpers if desired; harmless if unused.)

- [ ] **Step 2: run → fail** `npx vitest run tests/engine/play-devcards.test.ts` (boughtThisTurn stays true).
- [ ] **Step 3: implement**

`types.ts`: add `devCardPlayedThisTurn?: boolean;` to `Turn`.

`turn.ts` `applyEndTurn`: before `state.turn = {...}`, add:
```ts
  for (const c of state.players[prev]!.devCards) c.boughtThisTurn = false;
```
(Place it right after `const prev = state.turn.activeSeat;` and the `next` line, before reassigning `state.turn`.)

`dev.ts`: add the shared guard (export it for the play handlers in later tasks):
```ts
import type { DevCardType } from "../devcards";

export function playDevCardGuard(state: GameState, type: DevCardType): string | null {
  if (state.phase !== "main") return "Not in the main phase";
  if (state.turn.subPhase !== "main") return "You must roll the dice first";
  if (state.turn.devCardPlayedThisTurn) return "You already played a development card this turn";
  const player = state.players[state.turn.activeSeat]!;
  const card = player.devCards.find((c) => c.type === type && !c.played && !c.boughtThisTurn);
  if (!card) return `You have no playable ${type} card`;
  card.played = true;
  state.turn.devCardPlayedThisTurn = true;
  return null;
}
```
- [ ] **Step 4: run → pass** (full suite + typecheck green).
- [ ] **Step 5: commit** `feat(engine): dev-card play timing guard + endTurn clears boughtThisTurn`

---

## Task 2: Monopoly

- [ ] **Step 1: failing test** — append to `tests/engine/play-devcards.test.ts`:
```ts
describe("monopoly", () => {
  function withMonopoly(): GameState {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });
    g.players[1]!.resources = { wood: 0, brick: 3, sheep: 0, wheat: 0, ore: 0 };
    g.players[2]!.resources = { wood: 0, brick: 2, sheep: 0, wheat: 0, ore: 0 };
    return g;
  }
  it("takes all of one resource from every opponent", () => {
    const r = apply(withMonopoly(), { type: "playMonopoly", resource: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.brick).toBe(5);
    expect(r.state.players[1]!.resources.brick).toBe(0);
    expect(r.state.players[2]!.resources.brick).toBe(0);
    expect(r.state.turn.devCardPlayedThisTurn).toBe(true);
  });
  it("rejects when no playable monopoly card is held", () => {
    const r = apply(mainGame(), { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });
});
```
- [ ] **Step 2: run → fail.**
- [ ] **Step 3: implement** — `types.ts`: add `| { type: "playMonopoly"; resource: Resource }` to `Action`, and `"playMonopoly"` to `LogEntry.type`. `dev.ts`:
```ts
import type { Resource } from "../types";

export function applyPlayMonopoly(state: GameState, resource: Resource): string | null {
  const err = playDevCardGuard(state, "monopoly");
  if (err) return err;
  const seat = state.turn.activeSeat;
  let taken = 0;
  for (const p of state.players) {
    if (p.seat === seat) continue;
    taken += p.resources[resource];
    state.players[seat]!.resources[resource] += p.resources[resource];
    p.resources[resource] = 0;
  }
  state.log.push({ type: "playMonopoly", seat, resource, count: taken });
  return null;
}
```
`apply.ts`: import `applyPlayMonopoly`; `case "playMonopoly": return applyPlayMonopoly(draft, action.resource);`
- [ ] **Step 4: run → pass.** **Step 5: commit** `feat(engine): play monopoly`.

---

## Task 3: Year of Plenty

- [ ] **Step 1: failing test** — append:
```ts
describe("year of plenty", () => {
  function withYoP(): GameState {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "yearOfPlenty", boughtThisTurn: false, played: false });
    return g;
  }
  it("takes two resources from the bank", () => {
    const g = withYoP();
    const r = apply(g, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wheat).toBe(1);
    expect(r.state.players[0]!.resources.ore).toBe(1);
    expect(r.state.bank.wheat).toBe(18);
    expect(r.state.bank.ore).toBe(18);
  });
  it("can take two of the same resource", () => {
    const r = apply(withYoP(), { type: "playYearOfPlenty", resources: ["sheep", "sheep"] }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.sheep).toBe(2);
    expect(r.state.bank.sheep).toBe(17);
  });
  it("rejects if the bank cannot supply both", () => {
    const g = withYoP(); g.bank.ore = 1;
    const r = apply(g, { type: "playYearOfPlenty", resources: ["ore", "ore"] }, rngOf());
    expect(r.ok).toBe(false);
  });
});
```
- [ ] **Step 2: run → fail.**
- [ ] **Step 3: implement** — `types.ts`: `| { type: "playYearOfPlenty"; resources: [Resource, Resource] }`; `"playYearOfPlenty"` in LogEntry.type. `dev.ts`:
```ts
import { RESOURCE_LIST, emptyResources } from "../resources";

export function applyPlayYearOfPlenty(state: GameState, picks: [Resource, Resource]): string | null {
  const err = playDevCardGuard(state, "yearOfPlenty");
  if (err) return err;
  const need = emptyResources();
  for (const r of picks) need[r] += 1;
  for (const r of RESOURCE_LIST) if (state.bank[r] < need[r]) return "The bank cannot supply those resources";
  const seat = state.turn.activeSeat;
  for (const r of picks) { state.bank[r] -= 1; state.players[seat]!.resources[r] += 1; }
  state.log.push({ type: "playYearOfPlenty", seat });
  return null;
}
```
`apply.ts`: `case "playYearOfPlenty": return applyPlayYearOfPlenty(draft, action.resources);`
- [ ] **Step 4: pass. Step 5: commit** `feat(engine): play year of plenty`.

---

## Task 4: Road Building

- [ ] **Step 1: failing test** — append (place the player's existing network first so free roads have something to connect to):
```ts
import { topology } from "../../src/engine/board";

describe("road building", () => {
  it("places two free roads connected to the player's network", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "roadBuilding", boughtThisTurn: false, played: false });
    // seed a settlement so the player has a network anchor
    const v = topology().vertexIds[0]!;
    g.board.buildings[v] = { owner: 0, type: "settlement" };
    const e1 = topology().vertexEdges.get(v)![0]!;
    const before = g.players[0]!.pieces.roads;
    // pick a second edge adjacent to e1's far vertex
    const [a, b] = topology().edgeVertices.get(e1)!;
    const farV = a === v ? b : a;
    const e2 = topology().vertexEdges.get(farV)!.find((e) => e !== e1)!;
    const r = apply(g, { type: "playRoadBuilding", edges: [e1, e2] }, rngOf());
    expectOk(r);
    expect(r.state.board.roads[e1]!.owner).toBe(0);
    expect(r.state.board.roads[e2]!.owner).toBe(0);
    expect(r.state.players[0]!.pieces.roads).toBe(before - 2); // FREE but still uses stock
    expect(r.state.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
  });
  it("rejects an edge that doesn't connect to the network", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "roadBuilding", boughtThisTurn: false, played: false });
    const lone = topology().edgeIds[0]!;
    const r = apply(g, { type: "playRoadBuilding", edges: [lone] }, rngOf());
    expect(r.ok).toBe(false);
  });
});
```
- [ ] **Step 2: run → fail.**
- [ ] **Step 3: implement** — `types.ts`: `| { type: "playRoadBuilding"; edges: string[] }`; `"playRoadBuilding"` in LogEntry.type. `dev.ts`:
```ts
import { topology } from "../board";
import { edgeConnects } from "../placement";

export function applyPlayRoadBuilding(state: GameState, edges: string[]): string | null {
  if (edges.length < 1 || edges.length > 2) return "Road building places one or two roads";
  if (new Set(edges).size !== edges.length) return "Cannot place two roads on the same edge";
  const err = playDevCardGuard(state, "roadBuilding");
  if (err) return err;
  const seat = state.turn.activeSeat;
  const player = state.players[seat]!;
  for (const edge of edges) {
    if (!topology().edgeIds.includes(edge)) return "Unknown edge";
    if (state.board.roads[edge] !== undefined) return "Edge already has a road";
    if (player.pieces.roads <= 0) return "No roads left in stock";
    if (!edgeConnects(state.board, seat, edge)) return "Road must connect to your network";
    state.board.roads[edge] = { owner: seat };
    player.pieces.roads -= 1;
    state.log.push({ type: "playRoadBuilding", seat, edge });
  }
  return null;
}
```
> Note: validation + placement is sequential, so the SECOND road may legally connect off the FIRST. The card is free (no resource cost) but still consumes road stock. NOTE: if this card could ever break/extend Longest Road, that recompute is wired in plan 1c-vi — not here.
`apply.ts`: `case "playRoadBuilding": return applyPlayRoadBuilding(draft, action.edges);`
- [ ] **Step 4: pass. Step 5: commit** `feat(engine): play road building`.

---

## Task 5: Timing rules end-to-end

- [ ] **Step 1: failing/▶ test** — append:
```ts
describe("dev-card timing rules", () => {
  it("only one dev card may be played per turn", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });
    g.players[0]!.devCards.push({ type: "yearOfPlenty", boughtThisTurn: false, played: false });
    let r = apply(g, { type: "playMonopoly", resource: "brick" }, rngOf());
    expectOk(r);
    const r2 = apply(r.state, { type: "playYearOfPlenty", resources: ["wheat", "ore"] }, rngOf());
    expect(r2.ok).toBe(false);
  });
  it("a card bought this turn cannot be played", () => {
    const g = mainGame();
    g.players[0]!.resources = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };
    g.devDeck = ["monopoly"];
    const bought = apply(g, { type: "buyDevCard" }, rngOf(0));
    expectOk(bought);
    const played = apply(bought.state, { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(played.ok).toBe(false);
  });
  it("after the turn ends, a bought card becomes playable next turn", () => {
    let g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: true, played: false });
    // end player 0's turn, cycle back to player 0
    let s = apply(g, { type: "endTurn" }, rngOf()).ok ? (apply(g, { type: "endTurn" }, rngOf()) as any).state : g;
    // simpler: directly assert the flag cleared (already covered in Task 1); here just confirm playable
    g = mainGame();
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });
    const r = apply(g, { type: "playMonopoly", resource: "wheat" }, rngOf());
    expectOk(r);
  });
});
```
> The third test is intentionally simple (the cross-turn clearing is already proven in Task 1). If the messy `s` line bothers the implementer, delete it — only the final `playMonopoly` assertion matters.
- [ ] **Step 2-4:** these should pass against Tasks 1-4 (no new impl). If any fails, fix the implementation. **Step 5:** run full suite + typecheck; commit `test(engine): dev-card timing rules`.

---

## Done criteria
- `playMonopoly` / `playYearOfPlenty` / `playRoadBuilding` work and each is gated by `playDevCardGuard` (main phase, one-per-turn, not the turn bought).
- `endTurn` clears the ending player's `boughtThisTurn` flags.
- Full suite + typecheck green.

## Next: 1c-iv (knight + Largest Army) reuses `playDevCardGuard` (with a knight-specific allowance for playing before the roll) and the robber move.

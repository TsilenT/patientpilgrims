# Conscious Build Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the board's direct-tap building with a deliberate select-type-then-place flow: pick Road/Settlement/City, the board shows only that type's legal spots as ghosts with large tap targets, tap one to build, then return to neutral.

**Architecture:** A `buildMode` UI state in `GameView` (sibling to `roadEdges`/`devModal`). A pure `buildTargets(state, mode)` returns the per-type legal set the board renders. Setup auto-derives the mode from the sub-phase; the main phase uses a new `BuildControls` selector. `Slots` renders only the active set, each ghost backed by an enlarged invisible hit zone. Builds exit to neutral on success, stay on rejection.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, SVG board.

**Reference spec:** [docs/superpowers/specs/2026-06-06-conscious-build-mode-design.md](../specs/2026-06-06-conscious-build-mode-design.md)

> **⚠️ Before starting AND before pushing:** `git fetch origin` and rebase. `GameView.tsx`, `Slots.tsx`, and `interaction.test.tsx` are under active parallel development on another machine.

---

## File Structure

- **Modify `src/state/legalTargets.ts`** — add pure `buildTargets(state, mode)`.
- **Modify `src/ui/useDispatchWithError.ts`** — `run` returns `Promise<DispatchResult>` (so a build can exit mode on success). Backward-compatible.
- **Create `src/ui/panels/BuildControls.tsx`** — main-phase build selector (enable-aware buttons) + placement prompt + Cancel.
- **Modify `src/ui/GameView.tsx`** — `buildMode` state, derived `effectiveMode`, gated handlers, exit-on-success, render `BuildControls`, feed `buildTargets` to the board.
- **Modify `src/ui/board/Slots.tsx`** — enlarged invisible hit zones for the active ghosts.
- **Modify `src/ui/styles.css`** — `.build-controls` styling.
- **Tests:** `tests/state/buildTargets.test.ts` (new), `tests/ui/buildMode.test.tsx` (new), update `tests/ui/interaction.test.tsx`.

---

## Task 1: `buildTargets` — per-type legal sets

**Files:**
- Modify: `src/state/legalTargets.ts`
- Test: `tests/state/buildTargets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/state/buildTargets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTargets } from "../../src/state/legalTargets";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}

describe("buildTargets", () => {
  it("city mode targets only the active player's settlements", () => {
    const g = mainGame();
    const v0 = topology().vertexIds[0]!;
    const v1 = topology().vertexIds[10]!;
    g.board.buildings[v0] = { owner: 0, type: "settlement" };
    g.board.buildings[v1] = { owner: 1, type: "settlement" }; // opponent
    const t = buildTargets(g, "city");
    expect(t.vertices.has(v0)).toBe(true);
    expect(t.vertices.has(v1)).toBe(false); // not mine
    expect(t.edges.size).toBe(0);
  });

  it("road mode in main returns only edges, none in a fresh game (no network)", () => {
    const t = buildTargets(mainGame(), "road");
    expect(t.vertices.size).toBe(0);
    expect(t.edges.size).toBe(0); // no roads placed yet → nothing connects
  });

  it("settlement mode in setup offers distance-legal vertices", () => {
    const g = createInitialGame(
      [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
      createBoard({ mode: "beginner" }),
    );
    // fresh game starts in setupSettlement
    const t = buildTargets(g, "settlement");
    expect(t.vertices.size).toBeGreaterThan(0);
    expect(t.edges.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- tests/state/buildTargets.test.ts`
Expected: FAIL — `buildTargets` is not exported.

- [ ] **Step 3: Implement `buildTargets`**

In `src/state/legalTargets.ts`, add after the existing `legalTargets` function (the imports `topology`, `respectsDistance`, `vertexOnNetwork`, `edgeConnects`, and the `LegalTargets` type are already present in this file):

```ts
/** Legal spots for a single chosen build type (the conscious-build flow). */
export function buildTargets(state: GameState, mode: "road" | "settlement" | "city"): LegalTargets {
  const seat = state.turn.activeSeat;
  const sub = state.turn.subPhase;
  const t: LegalTargets = { vertices: new Set(), edges: new Set(), hexes: new Set() };

  if (mode === "road") {
    if (sub === "setupRoad") {
      const just = state.turn.setupSettlement;
      if (just) for (const e of topology().vertexEdges.get(just) ?? [])
        if (state.board.roads[e] === undefined) t.edges.add(e);
    } else if (sub === "main") {
      for (const e of topology().edgeIds)
        if (state.board.roads[e] === undefined && edgeConnects(state.board, seat, e)) t.edges.add(e);
    }
  } else if (mode === "settlement") {
    if (sub === "setupSettlement") {
      for (const v of topology().vertexIds) if (respectsDistance(state.board, v)) t.vertices.add(v);
    } else if (sub === "main") {
      for (const v of topology().vertexIds)
        if (state.board.buildings[v] === undefined && respectsDistance(state.board, v)
            && vertexOnNetwork(state.board, seat, v))
          t.vertices.add(v);
    }
  } else { // city
    if (sub === "main") {
      for (const v of topology().vertexIds) {
        const b = state.board.buildings[v];
        if (b && b.owner === seat && b.type === "settlement") t.vertices.add(v);
      }
    }
  }
  return t;
}

/** Total number of legal targets across vertices + edges (for selector enablement). */
export function buildTargetCount(state: GameState, mode: "road" | "settlement" | "city"): number {
  const t = buildTargets(state, mode);
  return t.vertices.size + t.edges.size;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- tests/state/buildTargets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/legalTargets.ts tests/state/buildTargets.test.ts
git commit -m "feat(ui): buildTargets — per-type legal spots for conscious build"
```

---

## Task 2: `useDispatchWithError` returns the result

So a successful build can exit build mode while a rejected one stays put.

**Files:**
- Modify: `src/ui/useDispatchWithError.ts`

- [ ] **Step 1: Change `run` to return the promise**

Replace the `run` callback in `src/ui/useDispatchWithError.ts` so it returns `Promise<DispatchResult>` while still surfacing the toast:

```ts
import { useCallback, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Action } from "../engine/types";
import type { DispatchResult } from "../state/store";

/**
 * Dispatch an action and capture a rejected dispatch's error for a Toast.
 * `run` resolves to the DispatchResult so callers can react to success (e.g. exit
 * build mode); callers that ignore the return value behave exactly as before.
 */
export function useDispatchWithError(): {
  run: (a: Action) => Promise<DispatchResult>;
  error: string | null;
  dismissError: () => void;
} {
  const { dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    (a: Action): Promise<DispatchResult> =>
      Promise.resolve(dispatch(a)).then((r) => {
        if (!r.ok) setError(r.error);
        return r;
      }),
    [dispatch],
  );
  const dismissError = useCallback(() => setError(null), []);
  return { run, error, dismissError };
}
```

- [ ] **Step 2: Typecheck (existing callers must still compile)**

Run: `npm run typecheck`
Expected: PASS. Existing callers use `run(action)` as a statement or `return run(action)` inside `(v: string) => void` handlers; a function returning `Promise<DispatchResult>` is assignable where `=> void` is expected, so no other file changes are needed.

- [ ] **Step 3: Run the full UI suite (no behavior change expected)**

Run: `npm run test:run`
Expected: PASS — all current tests still green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/useDispatchWithError.ts
git commit -m "refactor(ui): useDispatchWithError run() returns the result"
```

---

## Task 3: `BuildControls` selector + placement prompt

**Files:**
- Create: `src/ui/panels/BuildControls.tsx`
- Modify: `src/ui/styles.css`
- Test: `tests/ui/buildMode.test.tsx` (selector portion)

- [ ] **Step 1: Write the failing test**

Create `tests/ui/buildMode.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameProvider } from "../../src/state/GameProvider";
import { GameStore } from "../../src/state/gameStore";
import { BuildControls } from "../../src/ui/panels/BuildControls";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

function mainGame(): GameState {
  const g = createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function store(g: GameState) { return new GameStore(g, new LocalStoragePersistence(), mulberry32(0)); }

test("city button enables when you can afford it and own a settlement", () => {
  const g = mainGame();
  const v = topology().vertexIds[0]!;
  g.board.buildings[v] = { owner: 0, type: "settlement" };
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 }; // exactly a city
  render(
    <GameProvider store={store(g)}>
      <BuildControls buildMode={null} onSelect={() => {}} onCancel={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByRole("button", { name: /city/i })).toBeEnabled();
});

test("road button disabled with no resources / no network", () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  render(
    <GameProvider store={store(g)}>
      <BuildControls buildMode={null} onSelect={() => {}} onCancel={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByRole("button", { name: /road/i })).toBeDisabled();
});

test("placement mode shows a prompt and a cancel button", () => {
  render(
    <GameProvider store={store(mainGame())}>
      <BuildControls buildMode="settlement" onSelect={() => {}} onCancel={() => {}} />
    </GameProvider>,
  );
  expect(screen.getByText(/tap a spot to build a settlement/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- tests/ui/buildMode.test.tsx`
Expected: FAIL — cannot resolve `BuildControls`.

- [ ] **Step 3: Implement `BuildControls`**

Create `src/ui/panels/BuildControls.tsx`:

```tsx
import { useGame } from "../../state/GameProvider";
import { buildTargetCount } from "../../state/legalTargets";
import { canAfford, COSTS } from "../../engine";

export type BuildMode = "road" | "settlement" | "city" | null;

const OPTIONS: { mode: "road" | "settlement" | "city"; label: string; hint: string }[] = [
  { mode: "road", label: "🛣️ Road", hint: "Costs 1 wood, 1 brick" },
  { mode: "settlement", label: "🏠 Settlement", hint: "Costs 1 wood, 1 brick, 1 sheep, 1 wheat" },
  { mode: "city", label: "🏙️ City", hint: "Upgrade a settlement — costs 2 wheat, 3 ore" },
];

/** Main-phase build selector + placement prompt. Renders nothing outside the main phase. */
export function BuildControls({ buildMode, onSelect, onCancel }: {
  buildMode: BuildMode;
  onSelect: (m: "road" | "settlement" | "city") => void;
  onCancel: () => void;
}) {
  const { state } = useGame();
  if (state.turn.subPhase !== "main") return null;

  if (buildMode !== null) {
    return (
      <div className="build-controls" role="group" aria-label="Placing a build">
        <span className="build-prompt">Tap a spot to build a {buildMode}</span>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }

  const me = state.players[state.turn.activeSeat]!;
  return (
    <div className="build-controls" role="group" aria-label="Build">
      {OPTIONS.map(({ mode, label, hint }) => {
        const enabled = canAfford(me.resources, COSTS[mode]) && buildTargetCount(state, mode) > 0;
        return (
          <button key={mode} disabled={!enabled} title={hint} onClick={() => onSelect(mode)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Add styling**

Append to `src/ui/styles.css`:

```css
.build-controls { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; }
.build-controls .build-prompt { color: var(--gold); font-weight: 700; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:run -- tests/ui/buildMode.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ui/panels/BuildControls.tsx src/ui/styles.css tests/ui/buildMode.test.tsx
git commit -m "feat(ui): BuildControls selector + placement prompt"
```

---

## Task 4: Wire build mode into `GameView`

**Files:**
- Modify: `src/ui/GameView.tsx`

- [ ] **Step 1: Add imports and `buildMode` state**

In `src/ui/GameView.tsx`, update the imports near the top:

```ts
import { legalTargets, legalRoadBuildingEdges, buildTargets } from "../state/legalTargets";
import { BuildControls, type BuildMode } from "./panels/BuildControls";
```

And add the state next to the other `useState` hooks (after `roadEdges`):

```ts
const [buildMode, setBuildMode] = useState<BuildMode>(null);
```

- [ ] **Step 2: Derive the effective mode and the active legal set**

Replace the existing `legal` computation block (the `const legal = !interactive ? NO_TARGETS : ...` expression) with:

```ts
// Setup forces the build type; the main phase uses the player's selection.
const effectiveMode: BuildMode =
  sub === "setupSettlement" ? "settlement"
  : sub === "setupRoad" ? "road"
  : buildMode;

const legal = !interactive
  ? NO_TARGETS
  : roadEdges !== null
    ? { vertices: new Set<string>(), edges: legalRoadBuildingEdges(state, roadEdges), hexes: new Set<string>() }
    : sub === "movingRobber"
      ? legalTargets(state) // robber hex overlay
      : effectiveMode !== null
        ? buildTargets(state, effectiveMode)
        : NO_TARGETS; // main-phase neutral → board read-only
```

- [ ] **Step 3: Gate the board handlers by the effective mode + exit on success**

Replace the existing `onVertex` and `onEdge` handlers with versions that key off `effectiveMode` and clear `buildMode` after a successful main-phase build:

```ts
const finishBuild = (ok: boolean) => { if (ok) setBuildMode(null); };

const onVertex = async (v: string) => {
  if (!interactive || roadEdges !== null) return;
  if (effectiveMode === "settlement") {
    if (sub === "setupSettlement") { await run({ type: "setupSettlement", vertex: v }); return; }
    if (sub === "main") { const r = await run({ type: "buildSettlement", vertex: v }); finishBuild(r.ok); }
    return;
  }
  if (effectiveMode === "city" && sub === "main") {
    const r = await run({ type: "buildCity", vertex: v }); finishBuild(r.ok);
  }
};

const onEdge = async (e: string) => {
  if (!interactive) return;
  if (roadEdges !== null) {
    const next = [...roadEdges, e];
    if (next.length >= 2) { await run({ type: "playRoadBuilding", edges: next }); setRoadEdges(null); }
    else setRoadEdges(next);
    return;
  }
  if (effectiveMode !== "road") return;
  if (sub === "setupRoad") { await run({ type: "setupRoad", edge: e }); return; }
  if (sub === "main") { const r = await run({ type: "buildRoad", edge: e }); finishBuild(r.ok); }
};
```

(`onHex` is unchanged — the robber flow stays a direct tap.)

- [ ] **Step 4: Render `BuildControls`, and hide `ActionBar` during placement**

In the actionable branch (the final `: ( ... )` of the turn-gating ternary), replace the lone `<ActionBar />` with:

```tsx
          {buildMode === null && <ActionBar />}
          <BuildControls buildMode={buildMode} onSelect={setBuildMode} onCancel={() => setBuildMode(null)} />
```

(Leave the rest of that branch — the `bottom-sheet` tabs — unchanged.)

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck PASS. Some existing `interaction.test.tsx` cases that direct-tapped in the main phase will now FAIL (expected — fixed in Task 6). Setup/robber/dev-card/online tests stay green. Note which fail.

- [ ] **Step 6: Commit**

```bash
git add src/ui/GameView.tsx
git commit -m "feat(ui): GameView build-mode gating (select type, then place)"
```

---

## Task 5: Enlarge the board hit zones in `Slots`

**Files:**
- Modify: `src/ui/board/Slots.tsx`

- [ ] **Step 1: Rewrite `Slots` with enlarged invisible hit targets**

Replace the body of `src/ui/board/Slots.tsx` with (keeps every `data-*` attribute the board tests rely on; adds a transparent ~20px hit shape over each active ghost):

```tsx
import type { GameState } from "../../engine/types";
import type { BoardLayout } from "./layout";
import type { LegalTargets } from "../../state/legalTargets";
import { topology } from "../../engine/board";

const VERTEX_HIT = 20; // invisible tap radius (SVG units) over the small visible ghost
const EDGE_HIT = 20;   // invisible tap band width over the thin visible ghost

export function Slots({ state, layout, legal, onVertex, onEdge, onHex }: {
  state: GameState; layout: BoardLayout; legal: LegalTargets;
  onVertex: (v: string) => void; onEdge: (e: string) => void; onHex: (h: string) => void;
}) {
  const topo = topology();
  const color = (seat: number) => state.players[seat]!.color;
  return (
    <g>
      {/* legal-hex click overlays (robber) */}
      {[...legal.hexes].map((hid) => {
        const corners = topo.hexVertices.get(hid)!.map((v) => layout.vertex[v]!);
        const points = corners.map((p) => `${p.x},${p.y}`).join(" ");
        return <polygon key={hid} data-hex-slot={hid} points={points} fill="#fff" fillOpacity={0.15}
          style={{ cursor: "pointer" }} onClick={() => onHex(hid)} />;
      })}

      {topo.edgeIds.map((eid) => {
        const road = state.board.roads[eid];
        const [a, b] = topo.edgeVertices.get(eid)!;
        const pa = layout.vertex[a]!, pb = layout.vertex[b]!;
        if (road) return <line key={eid} data-road={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
          stroke={color(road.owner)} strokeWidth={7} strokeLinecap="round" />;
        if (!legal.edges.has(eid)) return null; // inert when not an active target
        return (
          <g key={eid}>
            <line data-edge-slot={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="transparent" strokeWidth={EDGE_HIT} strokeLinecap="round"
              style={{ cursor: "pointer" }} onClick={() => onEdge(eid)} />
            <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#ffffff" strokeOpacity={0.7}
              strokeWidth={7} strokeLinecap="round" pointerEvents="none" />
          </g>
        );
      })}

      {topo.vertexIds.map((vid) => {
        const b = state.board.buildings[vid];
        const p = layout.vertex[vid]!;
        const isLegal = legal.vertices.has(vid);
        if (b) {
          // A placed building. In city mode it is a legal upgrade target → add a big hit zone.
          return (
            <g key={vid}>
              {isLegal && <circle cx={p.x} cy={p.y} r={VERTEX_HIT} fill="transparent"
                style={{ cursor: "pointer" }} onClick={() => onVertex(vid)} />}
              <circle data-building={vid} cx={p.x} cy={p.y} r={b.type === "city" ? 11 : 8}
                fill={color(b.owner)} stroke="#234" strokeWidth={2} pointerEvents="none" />
            </g>
          );
        }
        if (!isLegal) return null; // inert empty vertex
        return (
          <g key={vid}>
            <circle data-vertex-slot={vid} cx={p.x} cy={p.y} r={VERTEX_HIT} fill="transparent"
              style={{ cursor: "pointer" }} onClick={() => onVertex(vid)} />
            <circle cx={p.x} cy={p.y} r={8} fill="#ffffff" fillOpacity={0.85} pointerEvents="none" />
          </g>
        );
      })}
    </g>
  );
}
```

- [ ] **Step 2: Run the board unit tests**

Run: `npm run test:run -- tests/ui/board.test.tsx`
Expected: PASS — `data-hex` count (19), `data-building` fill = owner color, `data-road` stroke = owner color all still hold (the building/road elements keep their attributes; `pointerEvents="none"` does not affect attribute queries).

- [ ] **Step 3: Commit**

```bash
git add src/ui/board/Slots.tsx
git commit -m "feat(ui): enlarge board tap targets for the active build type"
```

---

## Task 6: New interaction tests + fix existing ones

**Files:**
- Create part of: `tests/ui/buildMode.test.tsx` (append flow tests)
- Modify: `tests/ui/interaction.test.tsx`

- [ ] **Step 1: Append full-flow tests to `tests/ui/buildMode.test.tsx`**

Add these tests (they render the whole `GameView`):

```tsx
import { GameView } from "../../src/ui/GameView";
import userEvent from "@testing-library/user-event";

test("main phase is read-only until a build type is selected", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  // give seat 0 a road network so a settlement/road would be legal IF tapped
  const e = topology().edgeIds[0]!;
  g.board.roads[e] = { owner: 0 };
  const s = store(g);
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  // no build type chosen → no vertex/edge slots are interactive
  expect(container.querySelector("[data-edge-slot]")).toBeNull();
  expect(container.querySelector("[data-vertex-slot]")).toBeNull();
  // selecting Road reveals road slots
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  expect(screen.getByText(/tap a spot to build a road/i)).toBeInTheDocument();
  expect(container.querySelector("[data-edge-slot]")).not.toBeNull();
});

test("selecting a type, placing, then returning to neutral", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 2, brick: 2, sheep: 0, wheat: 0, ore: 0 };
  const e0 = topology().edgeIds[0]!;
  g.board.roads[e0] = { owner: 0 };
  const s = store(g);
  const { container } = render(<GameProvider store={s}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  const slot = container.querySelector("[data-edge-slot]") as SVGElement;
  await userEvent.click(slot);
  // back to neutral: the selector is shown again, prompt is gone
  expect(screen.queryByText(/tap a spot to build a road/i)).toBeNull();
  expect(screen.getByRole("button", { name: /road/i })).toBeInTheDocument();
});

test("cancel exits placement without building", async () => {
  const g = mainGame();
  g.players[0]!.resources = { wood: 1, brick: 1, sheep: 0, wheat: 0, ore: 0 };
  const e0 = topology().edgeIds[0]!;
  g.board.roads[e0] = { owner: 0 };
  render(<GameProvider store={store(g)}><GameView /></GameProvider>);
  await userEvent.click(screen.getByRole("button", { name: /road/i }));
  await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(screen.queryByText(/tap a spot to build a road/i)).toBeNull();
});
```

- [ ] **Step 2: Run the new flow tests**

Run: `npm run test:run -- tests/ui/buildMode.test.tsx`
Expected: PASS (6 tests total).

- [ ] **Step 3: Inspect and fix `interaction.test.tsx`**

Run: `npm run test:run -- tests/ui/interaction.test.tsx`
Read each failure. For any case that, in the **main** phase, directly clicked a `[data-vertex-slot]` / `[data-edge-slot]` or a settlement to build, insert the build-type selection first. Pattern to apply per failing case:

```tsx
// BEFORE (main-phase direct build):
await userEvent.click(container.querySelector("[data-edge-slot]")!);

// AFTER:
await userEvent.click(screen.getByRole("button", { name: /road/i }));
await userEvent.click(container.querySelector("[data-edge-slot]")!);
```

For a settlement build use `{ name: /settlement/i }`; for a city upgrade use `{ name: /city/i }` (and note city targets are the `[data-building]` of your own settlement, which now carries the hit zone). **Setup-phase** cases need no change (mode is auto-derived). Ensure the test seeds enough resources for the build button to be enabled.

- [ ] **Step 4: Run the full suite + typecheck + build**

Run: `npm run typecheck && npm run test:run && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add tests/ui/buildMode.test.tsx tests/ui/interaction.test.tsx
git commit -m "test(ui): conscious-build flow tests + update direct-tap cases"
```

---

## Task 7: Verify in a real browser

- [ ] **Step 1:** `npm run dev`, open the app, start a hotseat game. In setup, confirm the bigger tap targets place settlement then road. Roll into the main phase; confirm the board is read-only until you pick Road/Settlement/City, the ghosts appear for only that type, a tap builds and returns to neutral, Cancel works, and unaffordable/no-target buttons are disabled.
- [ ] **Step 2:** Narrow the window to a phone width; confirm targets are comfortably tappable.

---

## Self-Review (coverage map)

- Spec §2 states/flow (neutral, placement, exit-on-success, stay-on-reject) → Task 4 (handlers) + Task 2 (result-returning run).
- Spec §2 setup auto-mode → Task 4 `effectiveMode`.
- Spec §2 robber unchanged → Task 4 (`onHex` untouched, `movingRobber` still uses `legalTargets`).
- Spec §3 per-type targets → Task 1 `buildTargets`.
- Spec §4 affordability + enablement → Task 3 (`canAfford` + `buildTargetCount`).
- Spec §5 enlarged hit zones → Task 5.
- Spec §6 components (BuildControls, GameView, Slots, legalTargets, styles) → Tasks 1,3,4,5.
- Spec §7 error handling (reject → toast, stay) → Task 4 `finishBuild` only exits on `ok`.
- Spec §8 testing → Tasks 1,3,6 + Task 7 manual.
- Spec §9 rollout/fetch-before-push → plan header warning.

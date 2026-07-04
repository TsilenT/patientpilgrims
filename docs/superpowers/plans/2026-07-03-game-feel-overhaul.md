# Game-Feel Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app behave like a game instead of a reactive website: locked viewport (no whole-page scroll on mobile), pinch-zoom/pan on the board with a reset control, no text selection / OS callouts, and assorted touch-feel fixes.

**Architecture:** Three layers of change. (1) Global shell: viewport meta + CSS that locks the page, kills selection/tap-highlight/overscroll, and keeps non-game routes (start screen, lobby) internally scrollable. (2) Layout: `.game-view` becomes a fixed-height flex column where the board stage flexes to fill remaining space and the bottom sheet scrolls internally. (3) Board viewport: pure transform math in `viewportMath.ts` (TDD), a `useBoardViewport` hook that turns pointer/pinch/wheel gestures into a clamped `translate+scale` applied to a `<g>` inside the existing SVG, plus floating zoom controls.

**Tech Stack:** React 19 + TypeScript + Vite, plain CSS (`src/ui/styles.css`), Vitest + Testing Library (jsdom), screenshot verification via Windows Chrome headless (see memory `wsl-screenshot-workflow`).

**Current-state audit (why each change):**
- `.game-view` is a flex column with `board { max-height: 62vh }` and the bottom sheet in normal flow → on a phone the page is taller than the viewport and the *whole page* scrolls.
- No `user-select` rules anywhere → every tap-drag selects text; mobile long-press opens the copy/search callout.
- No `-webkit-tap-highlight-color` → gray/blue flash on every tap in mobile Chrome/Safari.
- No `overscroll-behavior` → pull-to-refresh and rubber-banding fire mid-game.
- Board SVG has no zoom/pan; vertex/edge tap targets get small on a 390px screen.
- `index.html` has `viewport-fit=cover` but no `maximum-scale`/`user-scalable` and no `theme-color`; no safe-area padding is applied anywhere (`env(safe-area-inset-*)` unused).
- Double-tap-to-zoom stays enabled (no `touch-action: manipulation`), adding tap latency/accidental zooms.
- Internal scroll regions (log rail) show default desktop scrollbars.

---

### Task 1: Global shell lockdown (viewport meta, selection, overscroll)

**Files:**
- Modify: `index.html`
- Modify: `src/main.tsx`
- Modify: `src/ui/styles.css` (top `:root`/`body` section, lines ~1–30)

- [ ] **Step 1: Update `index.html` head**

Replace the viewport meta and add theme-color:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#0f1620" />
```

- [ ] **Step 2: Block iOS Safari page pinch in `src/main.tsx`**

iOS Safari ignores `user-scalable=no`; its non-standard `gesturestart` event is the hook to stop page pinch (the board implements its own pinch in Task 4). Add before the React render call:

```ts
// iOS Safari ignores user-scalable=no; suppress page pinch-zoom (the board has its own).
document.addEventListener("gesturestart", (e) => e.preventDefault());
```

- [ ] **Step 3: Add the shell-lockdown CSS**

In `src/ui/styles.css`, extend the base section (after the `body { ... }` rule):

```css
/* ---- Game shell: lock the page; the app manages its own scrolling ---- */
html, body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none; /* no pull-to-refresh / rubber-banding */
}
body {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;          /* no long-press copy/search sheet on iOS */
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}
/* Text entry (player names, share links) must stay selectable/copyable. */
input, textarea {
  user-select: text;
  -webkit-user-select: text;
}
/* Non-game routes (start screen, lobby, claim) still scroll as pages. */
main {
  height: 100dvh;
  overflow-y: auto;
}
button, [role="tab"] { touch-action: manipulation; } /* no double-tap-zoom latency */
:focus:not(:focus-visible) { outline: none; }        /* keyboard focus rings only */
/* Subtle scrollbars for internal panes. */
.tab-content, .log-rail {
  scrollbar-width: thin;
  scrollbar-color: var(--ghost-edge) transparent;
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (these are CSS/meta changes; jsdom is unaffected).

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.tsx src/ui/styles.css
git commit -m "Lock the app shell: no page zoom, selection, or overscroll"
```

---

### Task 2: Fixed-height game layout with internal scrolling

**Files:**
- Modify: `src/ui/board/BoardSvg.tsx` (wrap the SVG in a `.board-stage` div)
- Modify: `src/ui/styles.css` (`.game-view`, `.board`, `.bottom-sheet`, `.tab-content`, `.log-rail`, the `@media (min-width: 900px)` block)
- Test: `tests/ui/responsive.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `tests/ui/responsive.test.tsx` (it already renders `GameView` with a store; follow its existing setup helpers):

```tsx
test("the board renders inside a stage container that hosts overlays", () => {
  const { container } = renderGameView(); // use the file's existing render helper
  const stage = container.querySelector(".board-stage");
  expect(stage).not.toBeNull();
  expect(stage!.querySelector("svg.board")).not.toBeNull();
});
```

If the file has no shared render helper, construct the store exactly as its existing test does.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/responsive.test.tsx`
Expected: FAIL — `.board-stage` not found.

- [ ] **Step 3: Wrap the SVG in `BoardSvg.tsx`**

Wrap the returned `<svg>` in a stage div (the stage later hosts the zoom controls; nothing else changes — all props/classes on the `<svg>` stay):

```tsx
return (
  <div className="board-stage">
    <svg className={...existing...} ...existing props...>
      ...existing children...
    </svg>
  </div>
);
```

- [ ] **Step 4: Update the layout CSS**

In `src/ui/styles.css`:

Replace the `.game-view` rule:

```css
.game-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100vh;   /* fallback */
  height: 100dvh;  /* stable under mobile browser chrome */
  overflow: hidden;
  max-width: 1100px;
  margin: 0 auto;
  padding: calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right))
           calc(6px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));
}
```

Replace the `.board` sizing (keep the drop-shadow filter lines; the robber-placement variants are untouched):

```css
.board-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0; /* let it shrink; the SVG scales via viewBox */
}
.board {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 8px 22px rgba(0, 0, 0, 0.5));
}
```

Make the bottom sheet a fixed-height, internally scrolling pane:

```css
.bottom-sheet {
  /* existing background/border/shadow lines stay */
  flex: 0 0 clamp(190px, 34dvh, 320px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tabs { flex: none; }
.tab-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
```

Remove `max-height: 30vh` from `.log-rail` (the sheet now bounds it) — keep `overflow-y: auto` off it too; the `.tab-content` scrolls instead:

```css
.log-rail { list-style: none; padding: 0; margin: 0; font-size: 13px; }
```

Update the wide-screen block: the grid areas move to `.board-stage`, and rows must not exceed the viewport:

```css
@media (min-width: 900px) {
  .game-view {
    display: grid;
    grid-template-columns: 1fr 320px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "opponents opponents"
      "board      sheet"
      "actions    sheet";
    align-items: stretch;
  }
  .top-hud { grid-area: opponents; }
  .board-stage { grid-area: board; }
  .action-bar { grid-area: actions; align-self: start; }
  .waiting-banner { grid-area: actions; }
  .bottom-sheet { grid-area: sheet; border-radius: 14px; flex-basis: auto; min-height: 0; }
}
```

Note: `.board { max-height: 62vh }` and `.board { grid-area: board; max-height: 78vh }` are deleted — the stage sizes the board now.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/ui/responsive.test.tsx tests/ui/board.test.tsx tests/ui/e2e.test.tsx`
Expected: PASS (the new stage test included).

- [ ] **Step 6: Full suite**

Run: `npx vitest run`
Expected: all pass. Board-querying tests use `container.querySelector`, which tolerates the new wrapper.

- [ ] **Step 7: Commit**

```bash
git add src/ui/board/BoardSvg.tsx src/ui/styles.css tests/ui/responsive.test.tsx
git commit -m "Lock game layout to the viewport with internal scrolling"
```

---

### Task 3: Board viewport math (pure, TDD)

**Files:**
- Create: `src/ui/board/viewportMath.ts`
- Test: `tests/ui/viewportMath.test.ts`

The transform maps content point `p` to `scale * p + t`. Clamping keeps the visible window inside the board's viewBox: `tx ∈ [(minX+width)(1−s), minX(1−s)]` (same for y), which collapses to `0` at `s = 1` — so panning at rest is naturally a no-op.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/viewportMath.test.ts`:

```ts
import { test, expect } from "vitest";
import {
  IDENTITY, MIN_SCALE, MAX_SCALE,
  clampTransform, panBy, zoomAt,
  type ViewBox,
} from "../../src/ui/board/viewportMath";

const VB: ViewBox = { minX: -100, minY: -50, width: 200, height: 100 };

test("identity survives clamping", () => {
  expect(clampTransform(IDENTITY, VB)).toEqual(IDENTITY);
});

test("panning at scale 1 is a no-op (nothing to reveal)", () => {
  expect(panBy(IDENTITY, VB, 30, -20)).toEqual(IDENTITY);
});

test("zooming about a focus point keeps that point stationary", () => {
  const focus = { x: 20, y: 10 };
  const t = zoomAt(IDENTITY, VB, focus, 2);
  expect(t.scale).toBe(2);
  expect(t.scale * focus.x + t.tx).toBeCloseTo(focus.x);
  expect(t.scale * focus.y + t.ty).toBeCloseTo(focus.y);
});

test("scale clamps to [MIN_SCALE, MAX_SCALE]", () => {
  expect(zoomAt(IDENTITY, VB, { x: 0, y: 0 }, 100).scale).toBe(MAX_SCALE);
  expect(zoomAt(IDENTITY, VB, { x: 0, y: 0 }, 0.01).scale).toBe(MIN_SCALE);
});

test("panning while zoomed clamps to the board edges", () => {
  const t = zoomAt(IDENTITY, VB, { x: 0, y: 0 }, 2);
  const panned = panBy(t, VB, 10_000, 10_000);
  // Content's left/top edge may not pull inside the viewport:
  expect(panned.scale * VB.minX + panned.tx).toBeLessThanOrEqual(VB.minX);
  expect(panned.scale * VB.minY + panned.ty).toBeLessThanOrEqual(VB.minY);
});

test("zooming all the way back out recenters exactly to identity", () => {
  const zoomedPanned = panBy(zoomAt(IDENTITY, VB, { x: 20, y: 10 }, 2), VB, -30, 15);
  const back = zoomAt(zoomedPanned, VB, { x: -40, y: 0 }, 0.01);
  expect(back).toEqual(IDENTITY);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/viewportMath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/board/viewportMath.ts`**

```ts
/** Pan/zoom transform for the board SVG: content point p renders at scale*p + t. */
export interface ViewTransform { scale: number; tx: number; ty: number }
export interface ViewBox { minX: number; minY: number; width: number; height: number }

export const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamp scale to bounds and translation so the viewport never leaves the board. */
export function clampTransform(t: ViewTransform, vb: ViewBox): ViewTransform {
  const scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
  const tx = clamp(t.tx, (vb.minX + vb.width) * (1 - scale), vb.minX * (1 - scale));
  const ty = clamp(t.ty, (vb.minY + vb.height) * (1 - scale), vb.minY * (1 - scale));
  return { scale, tx, ty };
}

export function panBy(t: ViewTransform, vb: ViewBox, dx: number, dy: number): ViewTransform {
  return clampTransform({ ...t, tx: t.tx + dx, ty: t.ty + dy }, vb);
}

/** Zoom by `factor` keeping `focus` (viewport coords, viewBox units) stationary. */
export function zoomAt(
  t: ViewTransform, vb: ViewBox, focus: { x: number; y: number }, factor: number,
): ViewTransform {
  const scale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
  const r = scale / t.scale;
  return clampTransform(
    { scale, tx: focus.x - r * (focus.x - t.tx), ty: focus.y - r * (focus.y - t.ty) },
    vb,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/viewportMath.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/board/viewportMath.ts tests/ui/viewportMath.test.ts
git commit -m "Add clamped pan/zoom transform math for the board viewport"
```

---

### Task 4: `useBoardViewport` hook + BoardSvg integration + controls

**Files:**
- Create: `src/ui/board/useBoardViewport.ts`
- Modify: `src/ui/board/BoardSvg.tsx`
- Modify: `src/ui/styles.css` (board-stage controls, cursor, touch-action)
- Test: `tests/ui/boardViewport.test.tsx`

Gesture design: one pointer drags to pan; two pointers pinch about their midpoint; wheel zooms about the cursor; `+`/`−` buttons zoom about the center (desktop/a11y); a reset button appears only when transformed. A drag past an 8px slop suppresses the click that follows, so board taps (build/robber) never fire accidentally at the end of a pan. `touch-action: none` on the SVG hands all touches to the hook.

jsdom notes for tests: `getBoundingClientRect()` returns zeros there, so the hook must fall back to a 1:1 client-px→viewBox-unit mapping when the rect is degenerate; guard `setPointerCapture` with `?.` since jsdom lacks it. Tests then use client pixels as viewBox units directly.

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/boardViewport.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { BoardSvg } from "../../src/ui/board/BoardSvg";
import { createInitialGame, mulberry32 } from "../../src/engine";
import { createBoard } from "../../src/board";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";

const NO_TARGETS = { vertices: new Set<string>(), edges: new Set<string>(), hexes: new Set<string>() };

function game(): GameState {
  return createInitialGame(
    [{ name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" }],
    createBoard({ mode: "beginner" }),
  );
}

function renderBoard(overrides: Partial<Parameters<typeof BoardSvg>[0]> = {}) {
  return render(
    <BoardSvg state={game()} legal={NO_TARGETS}
      onVertex={() => {}} onEdge={() => {}} onHex={() => {}} {...overrides} />,
  );
}

const viewportG = (c: HTMLElement) => c.querySelector("[data-viewport]")!;

test("board starts untransformed with no reset button", () => {
  const { container } = renderBoard();
  expect(viewportG(container).getAttribute("transform")).toBe("translate(0 0) scale(1)");
  expect(screen.queryByRole("button", { name: /reset view/i })).toBeNull();
});

test("zoom-in button scales up and shows the reset button; reset restores identity", () => {
  const { container } = renderBoard();
  fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
  expect(viewportG(container).getAttribute("transform")).not.toBe("translate(0 0) scale(1)");
  fireEvent.click(screen.getByRole("button", { name: /reset view/i }));
  expect(viewportG(container).getAttribute("transform")).toBe("translate(0 0) scale(1)");
});

test("wheel zooms about the cursor", () => {
  const { container } = renderBoard();
  const svg = container.querySelector("svg.board")!;
  fireEvent.wheel(svg, { deltaY: -200, clientX: 40, clientY: 30 });
  const tf = viewportG(container).getAttribute("transform")!;
  expect(tf).not.toBe("translate(0 0) scale(1)");
});

test("dragging pans when zoomed and suppresses the trailing click", () => {
  const onEdge = vi.fn();
  const eid = topology().edgeIds[0]!;
  const legal = { ...NO_TARGETS, edges: new Set([eid]) };
  const { container } = renderBoard({ legal, onEdge });
  const svg = container.querySelector("svg.board")!;

  fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
  const before = viewportG(container).getAttribute("transform");

  const slot = container.querySelector(`[data-edge-slot="${eid}"]`)!;
  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: 60, clientY: 80 });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: 60, clientY: 80 });
  fireEvent.click(slot); // the click a real browser fires after the drag

  expect(viewportG(container).getAttribute("transform")).not.toBe(before);
  expect(onEdge).not.toHaveBeenCalled();
});

test("a clean tap still clicks board slots", () => {
  const onEdge = vi.fn();
  const eid = topology().edgeIds[0]!;
  const legal = { ...NO_TARGETS, edges: new Set([eid]) };
  const { container } = renderBoard({ legal, onEdge });
  const svg = container.querySelector("svg.board")!;
  const slot = container.querySelector(`[data-edge-slot="${eid}"]`)!;

  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.click(slot);
  expect(onEdge).toHaveBeenCalledWith(eid);
});

test("pinch with two pointers zooms in", () => {
  const { container } = renderBoard();
  const svg = container.querySelector("svg.board")!;
  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerDown(svg, { pointerId: 2, clientX: 120, clientY: 100 });
  fireEvent.pointerMove(svg, { pointerId: 2, clientX: 180, clientY: 100 });
  fireEvent.pointerUp(svg, { pointerId: 2, clientX: 180, clientY: 100 });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  const tf = viewportG(container).getAttribute("transform")!;
  const scale = Number(/scale\(([\d.]+)\)/.exec(tf)![1]);
  expect(scale).toBeGreaterThan(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/boardViewport.test.tsx`
Expected: FAIL — `[data-viewport]` not found / no zoom buttons.

- [ ] **Step 3: Implement `src/ui/board/useBoardViewport.ts`**

```ts
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent } from "react";
import { IDENTITY, clampTransform, panBy, zoomAt, type ViewBox, type ViewTransform } from "./viewportMath";

const TAP_SLOP_PX = 8;      // movement beyond this is a drag, not a tap
const BUTTON_ZOOM = 1.4;    // per +/- press
const WHEEL_ZOOM_RATE = 0.0015;

export function useBoardViewport(vb: ViewBox) {
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const suppressClick = useRef(false);

  /** Client px → viewBox units, honoring xMidYMid-meet letterboxing.
   *  Falls back to 1:1 when the rect is degenerate (jsdom). */
  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: clientX, y: clientY, k: 1 };
    const k = 1 / Math.min(rect.width / vb.width, rect.height / vb.height);
    const offX = (rect.width - vb.width / k) / 2;
    const offY = (rect.height - vb.height / k) / 2;
    return { x: (clientX - rect.left - offX) * k + vb.minX, y: (clientY - rect.top - offY) * k + vb.minY, k };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragged.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };

    if (pointers.current.size === 1) {
      if (Math.hypot(now.x - prev.x, now.y - prev.y) > TAP_SLOP_PX) dragged.current = true;
      if (dragged.current) {
        const { k } = toSvg(now.x, now.y);
        setTransform((t) => panBy(t, vb, (now.x - prev.x) * k, (now.y - prev.y) * k));
        pointers.current.set(e.pointerId, now);
      }
      return;
    }

    // Pinch: zoom about the midpoint by the ratio of pointer distances.
    const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
    if (!other) return;
    dragged.current = true;
    const dPrev = Math.hypot(prev.x - other.x, prev.y - other.y);
    const dNow = Math.hypot(now.x - other.x, now.y - other.y);
    if (dPrev > 0 && dNow > 0) {
      const mid = toSvg((now.x + other.x) / 2, (now.y + other.y) / 2);
      setTransform((t) => zoomAt(t, vb, mid, dNow / dPrev));
    }
    pointers.current.set(e.pointerId, now);
  };

  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && dragged.current) suppressClick.current = true;
  };

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
    const focus = toSvg(e.clientX, e.clientY);
    setTransform((t) => zoomAt(t, vb, focus, Math.exp(-e.deltaY * WHEEL_ZOOM_RATE)));
  };

  /** Capture-phase: swallow the click a browser fires after a drag gesture. */
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const center = { x: vb.minX + vb.width / 2, y: vb.minY + vb.height / 2 };
  const isTransformed = transform.scale !== 1 || transform.tx !== 0 || transform.ty !== 0;

  return {
    transform: clampTransform(transform, vb),
    isTransformed,
    svgRef,
    svgHandlers: {
      onPointerDown, onPointerMove,
      onPointerUp: endPointer, onPointerCancel: endPointer,
      onWheel, onClickCapture,
      onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    },
    zoomIn: () => setTransform((t) => zoomAt(t, vb, center, BUTTON_ZOOM)),
    zoomOut: () => setTransform((t) => zoomAt(t, vb, center, 1 / BUTTON_ZOOM)),
    reset: () => setTransform(IDENTITY),
  };
}
```

- [ ] **Step 4: Integrate into `src/ui/board/BoardSvg.tsx`**

```tsx
import { useBoardViewport } from "./useBoardViewport";

export function BoardSvg({ ... }: BoardSvgProps) {
  const layout = LAYOUT;
  const { minX, minY, width, height } = layout.viewBox;
  const vp = useBoardViewport(layout.viewBox);
  return (
    <div className="board-stage">
      <svg ref={vp.svgRef} {...vp.svgHandlers}
        className={/* existing class expression unchanged */}
        viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label="Catan board">
        <defs>{/* unchanged */}</defs>
        <g data-viewport
          transform={`translate(${vp.transform.tx} ${vp.transform.ty}) scale(${vp.transform.scale})`}>
          {/* existing tiles + Ports + Slots children move inside this g, unchanged */}
        </g>
      </svg>
      <div className="board-controls" role="group" aria-label="Board view">
        <button aria-label="Zoom in" onClick={vp.zoomIn}>+</button>
        <button aria-label="Zoom out" onClick={vp.zoomOut} disabled={!vp.isTransformed}>−</button>
        {vp.isTransformed && <button aria-label="Reset view" onClick={vp.reset}>⌖</button>}
      </div>
    </div>
  );
}
```

(This replaces Task 2's bare `<div className="board-stage">` wrapper.)

- [ ] **Step 5: Add the CSS**

In `src/ui/styles.css` (near the `.board-stage` rule from Task 2):

```css
.board {
  /* existing lines stay */
  touch-action: none; /* all touches belong to the pan/pinch hook */
  cursor: grab;
}
.board:active { cursor: grabbing; }
.board-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.board-controls button {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 19px;
  line-height: 1;
  border-radius: 9px;
  background: rgba(22, 32, 43, 0.88);
}
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run tests/ui/boardViewport.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass. Board tests that click slots directly (robber, buildMode, devcards, e2e) must stay green — a plain `fireEvent.click`/`userEvent.click` with no preceding drag is not suppressed.

- [ ] **Step 8: Commit**

```bash
git add src/ui/board/useBoardViewport.ts src/ui/board/BoardSvg.tsx src/ui/styles.css tests/ui/boardViewport.test.tsx
git commit -m "Add pinch-zoom and pan to the board with reset controls"
```

---

### Task 5: Visual verification pass (phone + desktop) and fallout fixes

**Files:**
- Possibly modify: `src/ui/styles.css` (whatever the screenshots reveal)

Use the screenshot workflow from memory `wsl-screenshot-workflow` (vite dev server + temp `shot.html` same-origin-iframe bootstrap + Windows Chrome `--headless=new` one-shot; clean up temp root files and `C:\Users\Public` profiles afterwards).

- [ ] **Step 1: Verify no page scroll on phone**

Seed a mid-game hotseat state (settlements/roads/resources/dev cards for realism — reuse the seed-script approach from the dev-card UX session). In `shot.html`, after resume, write a probe into the title:

```js
const de = f.contentDocument.documentElement;
document.title = `SCROLL ${de.scrollHeight}x${de.clientHeight} WIN ${f.contentWindow.innerHeight}`;
```

Run Chrome with `--dump-dom`, grep the `<title>`.
Expected: `scrollHeight === clientHeight` (no page scroll) at 390×844. If not equal, find the overflowing element (probe `document.body.scrollHeight` per child) and fix its flex sizing — the usual culprit is a missing `min-height: 0`.

- [ ] **Step 2: Screenshot key scenes at 390×844**

Scenes: main turn (action bar + sheet), robber placement (banner + confirm bar), road-building mid-placement, a dev-card modal, discard modal, win screen. Confirm: board fills the space between HUD and sheet; nothing clipped; sheet content scrolls internally (scroll it via the bootstrap and screenshot again).

- [ ] **Step 3: Screenshot desktop 1280×800**

Confirm the right-rail grid still lays out, the sheet scrolls internally, no page scrollbar appears.

- [ ] **Step 4: Verify zoom/pan visually**

In the bootstrap, dispatch a wheel/zoom-in click plus a drag on the board, screenshot: board is zoomed/panned, reset button (⌖) visible top-right. Then click reset, screenshot: identity restored, reset button gone.

- [ ] **Step 5: Fix whatever the screenshots reveal, re-run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 6: Clean up temp files, commit, send screenshots to Stephen**

```bash
rm -f shot.html seed-*.json scripts/shot-seed.ts
git add -u && git status --short   # verify only intended files
git commit -m "Polish fixed-viewport layout after visual verification"
```

Deliver the before/after screenshots (phone-readable summary; per user-working-style memory).

---

### Task 6 (optional, recommended): Home-screen app polish

Installing to the home screen is the single biggest "feels like a game, not a website" win on mobile — fullscreen, no browser chrome. Small and self-contained; skip if scope must stay tight.

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon.svg` (gold hex + dice pips on `#0f1620`, drawn by hand — no external assets)
- Modify: `index.html`

- [ ] **Step 1: Manifest**

```json
{
  "name": "Adulting Catan",
  "short_name": "Catan",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f1620",
  "theme_color": "#0f1620",
  "start_url": "/",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }]
}
```

- [ ] **Step 2: Head tags**

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

(iOS wants a PNG `apple-touch-icon`; rasterize `icon.svg` at 180×180 with the headless-Chrome screenshot trick and add `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`.)

- [ ] **Step 3: Verify + commit**

Load in a mobile browser (or emulate), check the icon and standalone display.

```bash
git add public/ index.html
git commit -m "Add web-app manifest and icons for home-screen install"
```

---

## Explicitly out of scope (noted for later)

- Sound effects / haptics (`navigator.vibrate`) on dice rolls and placements.
- Landscape-phone layout tuning (the flex column shrinks the board but isn't optimized).
- Animating board pan/zoom transitions (snap is fine; CSS transition on the `<g>` fights pinch).
- Offline/service-worker support.

## Self-review notes

- Spec coverage: no-page-scroll → Tasks 1–2, 5; zoom/pan + reset → Tasks 3–4; selection/callout → Task 1; "anything else" audit → tap-highlight, overscroll, double-tap latency, safe areas, scrollbars, theme-color (Tasks 1–2), home-screen (Task 6). ✓
- Type consistency: `ViewTransform`/`ViewBox`/`IDENTITY`/`zoomAt`/`panBy`/`clampTransform` names match across Tasks 3–4; `data-viewport` attribute matches tests. ✓
- Existing-test risk called out where relevant (Task 4 Step 7). ✓

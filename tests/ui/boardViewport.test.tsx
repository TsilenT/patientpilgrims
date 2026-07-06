// @vitest-environment jsdom
import { test, expect, vi } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { BoardSvg } from "../../src/ui/board/BoardSvg";
import { createInitialGame } from "../../src/engine";
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

test("a plain tap never captures the pointer; capture engages only once a drag starts", () => {
  // Real browsers retarget pointerup/click to the capturing element, so taking
  // capture on pointerdown steals every click from the slot elements (hexes,
  // vertices, edges) — the robber/build taps silently die in Chrome and Safari.
  const { container } = renderBoard();
  const svg = container.querySelector("svg.board")! as SVGSVGElement;
  const capture = vi.fn();
  (svg as unknown as { setPointerCapture: typeof capture }).setPointerCapture = capture;

  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  expect(capture).not.toHaveBeenCalled();

  // Past the tap slop it is a pan: capture so the drag survives leaving the svg.
  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(svg, { pointerId: 1, clientX: 120, clientY: 100 });
  expect(capture).toHaveBeenCalledWith(1);
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

test("a zoomed board keeps its rendered scale when the stage resizes; default view refits", () => {
  let notify: (() => void) | undefined;
  class FakeResizeObserver {
    constructor(cb: () => void) { notify = cb; }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  try {
    const { container } = renderBoard();
    const svg = container.querySelector("svg.board") as SVGSVGElement;
    let rect = { width: 400, height: 400 };
    svg.getBoundingClientRect = () =>
      ({ ...rect, top: 0, left: 0, right: rect.width, bottom: rect.height, x: 0, y: 0 }) as DOMRect;

    // Untransformed: a stage resize must NOT introduce a transform (keeps fit-to-view).
    act(() => notify!());
    rect = { width: 400, height: 300 };
    act(() => notify!());
    expect(viewportG(container).getAttribute("transform")).toBe("translate(0 0) scale(1)");

    // Zoomed: shrinking the stage counter-scales so rendered size is constant.
    fireEvent.click(screen.getByRole("button", { name: /zoom in/i }));
    const scaleOf = () =>
      Number(/scale\(([\d.]+)\)/.exec(viewportG(container).getAttribute("transform")!)![1]);
    const before = scaleOf();
    rect = { width: 400, height: 150 };
    act(() => notify!());
    expect(scaleOf()).toBeGreaterThan(before);

    // Growing back restores the original zoom.
    rect = { width: 400, height: 300 };
    act(() => notify!());
    expect(scaleOf()).toBeCloseTo(before, 5);
  } finally {
    vi.unstubAllGlobals();
  }
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

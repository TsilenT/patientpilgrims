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

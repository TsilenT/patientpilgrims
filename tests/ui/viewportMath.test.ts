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

test("panning works even at scale 1 (lift the board above an open panel)", () => {
  expect(panBy(IDENTITY, VB, 30, -20)).toEqual({ scale: 1, tx: 30, ty: -20 });
});

test("panning clamps so part of the board always stays visible", () => {
  const t = panBy(IDENTITY, VB, -10_000, -10_000);
  // Bounds: min + keep - s*(min+span), with keep = 15% of the span.
  expect(t.tx).toBeCloseTo(VB.minX + 0.15 * VB.width - (VB.minX + VB.width));
  expect(t.ty).toBeCloseTo(VB.minY + 0.15 * VB.height - (VB.minY + VB.height));
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

test("panning while zoomed clamps before the board leaves the screen", () => {
  const t = zoomAt(IDENTITY, VB, { x: 0, y: 0 }, 2);
  const panned = panBy(t, VB, 10_000, 10_000);
  // Content's left/top edge may not pass the keep-visible margin:
  expect(panned.scale * VB.minX + panned.tx).toBeLessThanOrEqual(VB.minX + VB.width * (1 - 0.15));
  expect(panned.scale * VB.minY + panned.ty).toBeLessThanOrEqual(VB.minY + VB.height * (1 - 0.15));
});

test("zooming back out keeps the pan (reset is the way home)", () => {
  const zoomedPanned = panBy(zoomAt(IDENTITY, VB, { x: 20, y: 10 }, 2), VB, -30, 15);
  const back = zoomAt(zoomedPanned, VB, { x: -40, y: 0 }, 0.01);
  expect(back.scale).toBe(1);
  expect(back.tx).not.toBe(0); // pan preserved, still clamped on-screen
});

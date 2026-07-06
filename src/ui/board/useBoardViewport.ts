import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, MouseEvent as ReactMouseEvent } from "react";
import { IDENTITY, clampTransform, panBy, zoomAt, type ViewBox, type ViewTransform } from "./viewportMath";

const TAP_SLOP_PX = 8;   // movement beyond this is a drag, not a tap
const BUTTON_ZOOM = 1.4; // per +/- press
const WHEEL_ZOOM_RATE = 0.0015;

/** Pointer-driven pan/pinch/wheel zoom for the board SVG. Returns a transform for an
 *  inner <g> plus handlers to spread on the <svg>. Drags suppress the trailing click
 *  so a pan never lands as a build/robber tap. */
export function useBoardViewport(vb: ViewBox) {
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const suppressClick = useRef(false);
  const lastFitScale = useRef<number | null>(null);

  // Keep the *rendered* zoom stable when the stage resizes (banners, confirm bars,
  // sheet expand/collapse): the SVG re-fits to its box, so counter-scale the
  // transform about the board center. The untouched default view is exempt — it
  // should keep fitting the whole board.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const center = { x: vb.minX + vb.width / 2, y: vb.minY + vb.height / 2 };
    const ro = new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fit = Math.min(rect.width / vb.width, rect.height / vb.height);
      const prev = lastFitScale.current;
      lastFitScale.current = fit;
      if (prev === null || prev === fit) return;
      setTransform((t) =>
        t.scale === 1 && t.tx === 0 && t.ty === 0 ? t : zoomAt(t, vb, center, prev / fit),
      );
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, [vb]);

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

  // No capture on pointerdown: browsers retarget pointerup/click to the capture
  // element, which would steal every tap from the slot elements (hex/vertex/edge
  // onClick would never fire). Capture starts only once a drag engages.
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
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
        e.currentTarget.setPointerCapture?.(e.pointerId); // keep the pan when it leaves the svg
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
    e.currentTarget.setPointerCapture?.(e.pointerId);
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
  const clamped = clampTransform(transform, vb);
  const isTransformed = clamped.scale !== 1 || clamped.tx !== 0 || clamped.ty !== 0;

  return {
    transform: clamped,
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

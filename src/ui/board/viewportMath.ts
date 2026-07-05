/** Pan/zoom transform for the board SVG: content point p renders at scale*p + t. */
export interface ViewTransform { scale: number; tx: number; ty: number }
export interface ViewBox { minX: number; minY: number; width: number; height: number }

export const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 3;
/** Fraction of the viewport that must stay covered by board content: panning is
 *  free (even at 1x — e.g. lift the board above an open hand panel) as long as
 *  this much of it remains on screen. */
export const KEEP_VISIBLE = 0.15;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) + 0; // +0 normalizes -0

/** Clamp scale to bounds and translation so the board can't be lost off-screen. */
export function clampTransform(t: ViewTransform, vb: ViewBox): ViewTransform {
  const scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
  const keepX = KEEP_VISIBLE * vb.width;
  const keepY = KEEP_VISIBLE * vb.height;
  // Content spans [s*min + t, s*(min+span) + t]; keep it overlapping the viewport.
  const tx = clamp(t.tx, vb.minX + keepX - scale * (vb.minX + vb.width), vb.minX + vb.width - keepX - scale * vb.minX);
  const ty = clamp(t.ty, vb.minY + keepY - scale * (vb.minY + vb.height), vb.minY + vb.height - keepY - scale * vb.minY);
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

import { topology } from "../../engine/board";
import { hexPixel, vertexPixel, edgePixel, parseKey } from "../../board";

export const SCALE = 60; // px per hex unit
const PAD = SCALE * 0.9;

export interface Pt { x: number; y: number }
export interface BoardLayout {
  hex: Record<string, Pt>;
  vertex: Record<string, Pt>;
  edge: Record<string, Pt>;
  viewBox: { minX: number; minY: number; width: number; height: number };
}

export function boardLayout(): BoardLayout {
  const topo = topology();
  const hex: Record<string, Pt> = {};
  const vertex: Record<string, Pt> = {};
  const edge: Record<string, Pt> = {};
  for (const h of topo.hexIds) { const p = hexPixel(parseKey(h)); hex[h] = { x: p.px * SCALE, y: p.py * SCALE }; }
  for (const v of topo.vertexIds) { const p = vertexPixel(v); vertex[v] = { x: p.px * SCALE, y: p.py * SCALE }; }
  for (const e of topo.edgeIds) { const p = edgePixel(e); edge[e] = { x: p.px * SCALE, y: p.py * SCALE }; }

  const xs = Object.values(vertex).map((p) => p.x);
  const ys = Object.values(vertex).map((p) => p.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const width = Math.max(...xs) - Math.min(...xs) + PAD * 2;
  const height = Math.max(...ys) - Math.min(...ys) + PAD * 2;
  return { hex, vertex, edge, viewBox: { minX, minY, width, height } };
}

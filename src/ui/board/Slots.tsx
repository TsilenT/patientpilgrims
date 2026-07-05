import type { GameState } from "../../engine/types";
import type { BoardLayout } from "./layout";
import type { LegalTargets } from "../../state/legalTargets";
import { topology } from "../../engine/board";

const VERTEX_HIT = 20; // invisible tap radius (SVG units) over the small visible ghost
const EDGE_HIT = 20;   // invisible tap band width over the thin visible ghost

export function Slots({ state, layout, legal, selectedHex, pendingRoads, onVertex, onEdge, onHex }: {
  state: GameState; layout: BoardLayout; legal: LegalTargets;
  selectedHex?: string | null;
  pendingRoads?: { edges: string[]; color: string } | null;
  onVertex: (v: string) => void; onEdge: (e: string) => void; onHex: (h: string) => void;
}) {
  const topo = topology();
  const color = (seat: number) => state.players[seat]!.color;
  const pendingSet = new Set(pendingRoads?.edges ?? []);
  return (
    <g>
      {topo.edgeIds.map((eid) => {
        const road = state.board.roads[eid];
        const [a, b] = topo.edgeVertices.get(eid)!;
        const pa = layout.vertex[a]!, pb = layout.vertex[b]!;
        if (road) return <line key={eid} data-road={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
          stroke={color(road.owner)} strokeWidth={7} strokeLinecap="round" />;
        if (pendingSet.has(eid)) {
          // A road picked but not yet confirmed (Road Building) — tap again to remove.
          return (
            <g key={eid}>
              <line data-pending-road={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="transparent" strokeWidth={EDGE_HIT} strokeLinecap="round"
                style={{ cursor: "pointer" }} onClick={() => onEdge(eid)} />
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#ffffff" strokeOpacity={0.9}
                strokeWidth={9} strokeLinecap="round" pointerEvents="none" />
              <line className="pending-road" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke={pendingRoads!.color} strokeWidth={7} strokeLinecap="round"
                strokeDasharray="10 7" pointerEvents="none" />
            </g>
          );
        }
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
              {isLegal && <circle data-vertex-slot={vid} cx={p.x} cy={p.y} r={VERTEX_HIT} fill="transparent"
                style={{ cursor: "pointer" }} onClick={() => onVertex(vid)} />}
              <circle data-building={vid} cx={p.x} cy={p.y} r={b.type === "city" ? 11 : 8}
                fill={color(b.owner)} stroke="#234" strokeWidth={2} pointerEvents="none" />
              {b.type === "city" && (
                <polygon
                  points={`${p.x},${p.y - 6} ${p.x - 6},${p.y + 5} ${p.x + 6},${p.y + 5}`}
                  fill="#ffffff"
                  stroke="#234"
                  strokeWidth={1}
                  strokeLinejoin="round"
                  pointerEvents="none"
                  aria-hidden="true"
                />
              )}
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

      {/* Legal-hex overlays (robber) — drawn last so the highlight and the
          selection ring read over roads and buildings. The selected ring is
          marching white dashes with gaps: no solid player color looks like it. */}
      {[...legal.hexes].map((hid) => {
        const corners = topo.hexVertices.get(hid)!.map((v) => layout.vertex[v]!);
        const points = corners.map((p) => `${p.x},${p.y}`).join(" ");
        const selected = selectedHex === hid;
        return (
          <g key={hid}>
            <polygon data-hex-slot={hid} data-selected={selected ? "true" : undefined}
              points={points} fill="#fff" fillOpacity={0.15}
              style={{ cursor: "pointer" }} onClick={() => onHex(hid)} />
            {selected && (
              <polygon className="hex-select-dash" points={points} fill="none" stroke="#ffffff"
                strokeWidth={6} strokeLinejoin="round" strokeDasharray="10 9" pointerEvents="none" />
            )}
          </g>
        );
      })}
    </g>
  );
}

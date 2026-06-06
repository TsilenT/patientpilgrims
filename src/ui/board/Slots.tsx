import type { GameState } from "../../engine/types";
import type { BoardLayout } from "./layout";
import type { LegalTargets } from "../../state/legalTargets";
import { topology } from "../../engine/board";

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
        const isLegal = legal.edges.has(eid);
        if (road) return <line key={eid} data-road={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
          stroke={color(road.owner)} strokeWidth={7} strokeLinecap="round" />;
        return <line key={eid} data-edge-slot={eid} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
          stroke={isLegal ? "#ffffff" : "transparent"} strokeOpacity={isLegal ? 0.7 : 0}
          strokeWidth={isLegal ? 7 : 12} strokeLinecap="round"
          style={{ cursor: isLegal ? "pointer" : "default" }}
          onClick={isLegal ? () => onEdge(eid) : undefined} />;
      })}
      {topo.vertexIds.map((vid) => {
        const b = state.board.buildings[vid];
        const p = layout.vertex[vid]!;
        const isLegal = legal.vertices.has(vid);
        if (b) return <circle key={vid} data-building={vid} cx={p.x} cy={p.y}
          r={b.type === "city" ? 11 : 8} fill={color(b.owner)} stroke="#234" strokeWidth={2}
          style={{ cursor: isLegal ? "pointer" : "default" }}
          onClick={isLegal ? () => onVertex(vid) : undefined} />;
        return <circle key={vid} data-vertex-slot={vid} cx={p.x} cy={p.y} r={isLegal ? 8 : 6}
          fill={isLegal ? "#ffffff" : "transparent"} fillOpacity={isLegal ? 0.85 : 0}
          style={{ cursor: isLegal ? "pointer" : "default" }}
          onClick={isLegal ? () => onVertex(vid) : undefined} />;
      })}
    </g>
  );
}

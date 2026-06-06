import type { Tile } from "../../engine/types";
import type { BoardLayout } from "./layout";
import { topology } from "../../engine/board";
import { HEX_ICON } from "../icons";

export function HexTile({ hid, tile, layout, hasRobber }: {
  hid: string; tile: Tile; layout: BoardLayout; hasRobber: boolean;
}) {
  const corners = topology().hexVertices.get(hid)!.map((v) => layout.vertex[v]!);
  const points = corners.map((p) => `${p.x},${p.y}`).join(" ");
  const c = layout.hex[hid]!;
  const emphasized = tile.number === 6 || tile.number === 8;
  return (
    <g data-hex={hid} data-kind={tile.kind} data-robber={hasRobber}>
      <polygon points={points} fill={`url(#hex-${tile.kind})`} stroke="rgba(255,255,255,.45)"
               strokeWidth={1.5} strokeLinejoin="round" />
      <text x={c.x} y={c.y - 16} textAnchor="middle" fontSize={18} aria-hidden="true">
        {HEX_ICON[tile.kind]}
      </text>
      {tile.number !== undefined && (
        <g>
          <circle cx={c.x} cy={c.y + 4} r={13} fill="#fbf7ee" stroke="#d8cfbb" />
          <text x={c.x} y={c.y + 9} textAnchor="middle" fontSize={15}
                fill={emphasized ? "#c0392b" : "#3a3a3a"} fontWeight={800}>
            {tile.number}
          </text>
        </g>
      )}
      {hasRobber && <circle data-testid="robber" cx={c.x} cy={c.y + 4} r={10} fill="#1a1a1a" opacity={0.82} />}
    </g>
  );
}

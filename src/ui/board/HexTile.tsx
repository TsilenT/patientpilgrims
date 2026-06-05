import type { Tile } from "../../engine/types";
import type { BoardLayout } from "./layout";
import { topology } from "../../engine/board";

const FILL: Record<string, string> = {
  wood: "#3f7d3a", brick: "#b5562b", sheep: "#8fce6b",
  wheat: "#e6c34d", ore: "#8a8f99", desert: "#d9c89a",
};

export function HexTile({ hid, tile, layout, hasRobber }: {
  hid: string; tile: Tile; layout: BoardLayout; hasRobber: boolean;
}) {
  const corners = topology().hexVertices.get(hid)!.map((v) => layout.vertex[v]!);
  const points = corners.map((p) => `${p.x},${p.y}`).join(" ");
  const c = layout.hex[hid]!;
  const emphasized = tile.number === 6 || tile.number === 8;
  return (
    <g data-hex={hid} data-kind={tile.kind} data-robber={hasRobber}>
      <polygon points={points} fill={FILL[tile.kind]} stroke="#234" strokeWidth={2} />
      {tile.number !== undefined && (
        <g>
          <circle cx={c.x} cy={c.y} r={16} fill="#f4efe0" stroke="#234" />
          <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize={16}
                fill={emphasized ? "#c0392b" : "#222"} fontWeight={emphasized ? 700 : 400}>
            {tile.number}
          </text>
        </g>
      )}
      {hasRobber && <circle data-testid="robber" cx={c.x} cy={c.y} r={10} fill="#222" opacity={0.8} />}
    </g>
  );
}

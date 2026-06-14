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
  const TileIcon = HEX_ICON[tile.kind];
  return (
    <g data-hex={hid} data-kind={tile.kind} data-robber={hasRobber}>
      <polygon points={points} fill={`url(#hex-${tile.kind})`} stroke="rgba(255,255,255,.45)"
               strokeWidth={1.5} strokeLinejoin="round" />
      {TileIcon && (
        <TileIcon className="hex-icon" x={c.x - 12} y={c.y - 30} width={24} height={24} />
      )}
      {tile.number !== undefined && (() => {
        const ink = emphasized ? "#c0392b" : "#3a3a3a";
        // Probability pips: ways to roll the number on 2d6 (6/8 → 5, 2/12 → 1).
        const pips = 6 - Math.abs(7 - tile.number);
        const gap = 2.7;
        const startX = c.x - ((pips - 1) * gap) / 2;
        return (
          <g>
            <circle cx={c.x} cy={c.y + 4} r={13} fill="#fbf7ee" stroke="#d8cfbb" />
            <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize={13}
                  fill={ink} fontWeight={800}>
              {tile.number}
            </text>
            {Array.from({ length: pips }, (_, i) => (
              <circle key={i} cx={startX + i * gap} cy={c.y + 12} r={1} fill={ink} />
            ))}
          </g>
        );
      })()}
      {hasRobber && <circle data-testid="robber" cx={c.x} cy={c.y + 4} r={10} fill="#1a1a1a" opacity={0.82} />}
    </g>
  );
}

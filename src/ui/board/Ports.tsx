import type { PortKind } from "../../board";
import type { BoardLayout } from "./layout";
import type { Port, Resource } from "../../engine/types";
import { RESOURCE_ICON } from "../icons";

// Sign colors mirror the resource tiles; "any" gets a parchment dock board.
const SIGN_FILL: Record<PortKind, string> = {
  any: "#efe4c0",
  wood: "#5bbf6e",
  brick: "#df7b50",
  sheep: "#bfe487",
  wheat: "#f7d873",
  ore: "#b3c0cb",
};

const RATIO: Record<PortKind, string> = {
  any: "3:1", wood: "2:1", brick: "2:1", sheep: "2:1", wheat: "2:1", ore: "2:1",
};

const PORT_LABEL: Record<PortKind, string> = {
  any: "Any resource port, 3 to 1",
  wood: "Wood port, 2 to 1",
  brick: "Brick port, 2 to 1",
  sheep: "Sheep port, 2 to 1",
  wheat: "Wheat port, 2 to 1",
  ore: "Ore port, 2 to 1",
};

// Keep port markers far enough outside the board for readable piers, with a small
// along-coast drift so the docks feel hand-placed rather than mechanically aligned.
const PORT_SIGN_OFFSET = 48;
const PORT_TANGENT_SHIFT = 10;
const PIER_WOOD = "#8a5d35";

// Three resource-colored dots stand in for "any resource" on the 3:1 port.
function AnyMark({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx - 6} cy={cy - 5} r={3.2} fill="#df7b50" stroke="#2a2017" strokeWidth={0.6} />
      <circle cx={cx} cy={cy - 7} r={3.2} fill="#f7d873" stroke="#2a2017" strokeWidth={0.6} />
      <circle cx={cx + 6} cy={cy - 5} r={3.2} fill="#5bbf6e" stroke="#2a2017" strokeWidth={0.6} />
    </g>
  );
}

export function Ports({ ports, layout }: { ports: Port[]; layout: BoardLayout }) {
  return (
    <g data-testid="ports" pointerEvents="none">
      {ports.map((port) => {
        const [aId, bId] = port.vertices;
        const a = layout.vertex[aId!]!;
        const b = layout.vertex[bId!]!;
        const dockBaseX = (a.x + b.x) / 2;
        const dockBaseY = (a.y + b.y) / 2;
        const edgeDx = b.x - a.x;
        const edgeDy = b.y - a.y;
        const normalLength = Math.hypot(edgeDx, edgeDy) || 1;
        let ux = -edgeDy / normalLength;
        let uy = edgeDx / normalLength;
        if (ux * dockBaseX + uy * dockBaseY < 0) {
          ux = -ux;
          uy = -uy;
        }
        const tangentSign = port.edge.charCodeAt(0) % 2 === 0 ? -1 : 1;
        const tx = edgeDx / normalLength;
        const ty = edgeDy / normalLength;
        const cx = dockBaseX + ux * PORT_SIGN_OFFSET + tx * PORT_TANGENT_SHIFT * tangentSign;
        const cy = dockBaseY + uy * PORT_SIGN_OFFSET + ty * PORT_TANGENT_SHIFT * tangentSign;
        const Icon = port.kind === "any" ? null : RESOURCE_ICON[port.kind as Resource];

        return (
          <g key={port.edge} data-port-edge={port.edge} data-port-kind={port.kind} aria-label={PORT_LABEL[port.kind]}>
            {/* wooden piers from the two coastal corners to the dock */}
            <line className="port-pier" x1={a.x} y1={a.y} x2={cx} y2={cy} stroke={PIER_WOOD} strokeWidth={4.2} strokeLinecap="round" opacity={0.96} />
            <line className="port-pier" x1={b.x} y1={b.y} x2={cx} y2={cy} stroke={PIER_WOOD} strokeWidth={4.2} strokeLinecap="round" opacity={0.96} />
            {/* the dock sign */}
            <rect x={cx - 19} y={cy - 19} width={38} height={38} rx={10} fill={SIGN_FILL[port.kind]}
              stroke="#2a2017" strokeWidth={2} />
            {Icon
              ? <Icon className="hex-icon" x={cx - 9} y={cy - 16} width={18} height={18} />
              : <AnyMark cx={cx} cy={cy} />}
            {/* ratio pill */}
            <rect x={cx - 12} y={cy + 3} width={24} height={13} rx={6.5} fill="#1b2027" />
            <text x={cx} y={cy + 12.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
              {RATIO[port.kind]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

import type { PortKind } from "../../board";
import type { BoardLayout } from "./layout";
import type { Port } from "../../engine/types";

const PORT_FILL: Record<PortKind, string> = {
  any: "#f4efe0",
  wood: "#3f7d3a",
  brick: "#b5562b",
  sheep: "#8fce6b",
  wheat: "#e6c34d",
  ore: "#8a8f99",
};

const PORT_TEXT: Record<PortKind, string> = {
  any: "3:1",
  wood: "2:1",
  brick: "2:1",
  sheep: "2:1",
  wheat: "2:1",
  ore: "2:1",
};

const PORT_LABEL: Record<PortKind, string> = {
  any: "Any resource port, 3 to 1",
  wood: "Wood port, 2 to 1",
  brick: "Brick port, 2 to 1",
  sheep: "Sheep port, 2 to 1",
  wheat: "Wheat port, 2 to 1",
  ore: "Ore port, 2 to 1",
};

const PORT_INITIAL: Record<PortKind, string> = {
  any: "?",
  wood: "W",
  brick: "B",
  sheep: "S",
  wheat: "W",
  ore: "O",
};

const DARK_TEXT = new Set<PortKind>(["any", "sheep", "wheat"]);

export function Ports({ ports, layout }: { ports: Port[]; layout: BoardLayout }) {
  return (
    <g data-testid="ports" pointerEvents="none">
      {ports.map((port) => {
        const edge = layout.edge[port.edge]!;
        const [aId, bId] = port.vertices;
        const a = layout.vertex[aId!]!;
        const b = layout.vertex[bId!]!;
        const length = Math.hypot(edge.x, edge.y) || 1;
        const ux = edge.x / length;
        const uy = edge.y / length;
        const cx = edge.x + ux * 34;
        const cy = edge.y + uy * 34;
        const fill = PORT_FILL[port.kind] ?? "#f4efe0";
        const textFill = DARK_TEXT.has(port.kind) ? "#222" : "#fff";
        const resourceInitial = PORT_INITIAL[port.kind] ?? "?";
        const ariaLabel = PORT_LABEL[port.kind] ?? "Port";

        return (
          <g
            key={port.edge}
            data-port-edge={port.edge}
            data-port-kind={port.kind}
            aria-label={ariaLabel}
          >
            <line x1={a.x} y1={a.y} x2={cx} y2={cy} stroke="#234" strokeWidth={2} opacity={0.7} />
            <line x1={b.x} y1={b.y} x2={cx} y2={cy} stroke="#234" strokeWidth={2} opacity={0.7} />
            <circle cx={cx} cy={cy} r={19} fill={fill} stroke="#234" strokeWidth={2} />
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill={textFill}
            >
              {PORT_TEXT[port.kind]}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={textFill}
            >
              {resourceInitial}
            </text>
          </g>
        );
      })}
    </g>
  );
}

import type { GameState } from "../../engine/types";
import type { LegalTargets } from "../../state/legalTargets";
import { boardLayout } from "./layout";
import { HexTile } from "./HexTile";
import { Ports } from "./Ports";
import { Slots } from "./Slots";
import { useBoardViewport } from "./useBoardViewport";
import { RecenterIcon } from "../icons";

export interface BoardSvgProps {
  state: GameState;
  legal: LegalTargets;
  robberPlacement?: boolean;
  selectedRobberHex?: string | null;
  pendingRoads?: { edges: string[]; color: string } | null;
  onVertex: (v: string) => void;
  onEdge: (e: string) => void;
  onHex: (h: string) => void;
}

// Board geometry is static (depends only on the memoized topology), so compute it once.
const LAYOUT = boardLayout();

// colonists.io-style vertical gradients per tile kind (top → bottom).
const HEX_GRADIENT: Record<string, [string, string]> = {
  wood: ["#5bbf6e", "#3f8f4f"],
  brick: ["#df7b50", "#c0562f"],
  sheep: ["#bfe487", "#9ccc5a"],
  wheat: ["#f7d873", "#edc14e"],
  ore: ["#b3c0cb", "#8c9aa6"],
  desert: ["#efe4c0", "#e3d5a8"],
};

export function BoardSvg({ state, legal, robberPlacement = false, selectedRobberHex = null, pendingRoads = null, onVertex, onEdge, onHex }: BoardSvgProps) {
  const layout = LAYOUT;
  const { minX, minY, width, height } = layout.viewBox;
  const vp = useBoardViewport(layout.viewBox);
  return (
    <div className="board-stage">
      <svg ref={vp.svgRef} {...vp.svgHandlers}
        className={`board${robberPlacement ? " board--robber-placement" : ""}${selectedRobberHex !== null ? " board--robber-selected" : ""}`}
        viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label="game board">
        <defs>
          {Object.entries(HEX_GRADIENT).map(([kind, [top, bottom]]) => (
            <linearGradient key={kind} id={`hex-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={top} />
              <stop offset="100%" stopColor={bottom} />
            </linearGradient>
          ))}
        </defs>
        <g data-viewport
          transform={`translate(${vp.transform.tx} ${vp.transform.ty}) scale(${vp.transform.scale})`}>
          {Object.entries(state.board.tiles).map(([hid, tile]) => (
            <HexTile key={hid} hid={hid} tile={tile} layout={layout} hasRobber={state.board.robber === hid} />
          ))}
          <Ports ports={state.board.ports} layout={layout} />
          <Slots state={state} layout={layout} legal={legal} selectedHex={selectedRobberHex}
            pendingRoads={pendingRoads} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
        </g>
      </svg>
      <div className="board-controls" role="group" aria-label="Board view">
        <button aria-label="Zoom in" onClick={vp.zoomIn}>+</button>
        <button aria-label="Zoom out" onClick={vp.zoomOut} disabled={!vp.isTransformed}>−</button>
        {vp.isTransformed && <button aria-label="Reset view" onClick={vp.reset}><RecenterIcon /></button>}
      </div>
    </div>
  );
}

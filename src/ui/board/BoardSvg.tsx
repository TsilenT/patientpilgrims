import type { GameState } from "../../engine/types";
import { boardLayout, type LegalTargets } from "./layout";
import { HexTile } from "./HexTile";

export interface BoardSvgProps {
  state: GameState;
  legal: LegalTargets;
  onVertex: (v: string) => void;
  onEdge: (e: string) => void;
  onHex: (h: string) => void;
}

export function BoardSvg({ state, legal, onVertex, onEdge, onHex }: BoardSvgProps) {
  void legal; void onVertex; void onEdge; void onHex;
  const layout = boardLayout();
  const { minX, minY, width, height } = layout.viewBox;
  return (
    <svg className="board" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label="Catan board">
      {Object.entries(state.board.tiles).map(([hid, tile]) => (
        <HexTile key={hid} hid={hid} tile={tile} layout={layout} hasRobber={state.board.robber === hid} />
      ))}
      {/* Slots layer added in Task C3. */}
    </svg>
  );
}

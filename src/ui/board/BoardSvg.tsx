import type { GameState } from "../../engine/types";
import { boardLayout, type LegalTargets } from "./layout";
import { HexTile } from "./HexTile";
import { Slots } from "./Slots";

export interface BoardSvgProps {
  state: GameState;
  legal: LegalTargets;
  onVertex: (v: string) => void;
  onEdge: (e: string) => void;
  onHex: (h: string) => void;
}

export function BoardSvg({ state, legal, onVertex, onEdge, onHex }: BoardSvgProps) {
  const layout = boardLayout();
  const { minX, minY, width, height } = layout.viewBox;
  return (
    <svg className="board" viewBox={`${minX} ${minY} ${width} ${height}`} role="img" aria-label="Catan board">
      {Object.entries(state.board.tiles).map(([hid, tile]) => (
        <HexTile key={hid} hid={hid} tile={tile} layout={layout} hasRobber={state.board.robber === hid} />
      ))}
      <Slots state={state} layout={layout} legal={legal} onVertex={onVertex} onEdge={onEdge} onHex={onHex} />
    </svg>
  );
}

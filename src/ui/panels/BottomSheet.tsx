import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { SheetPeek } from "./SheetPeek";

export type SheetTab = "hand" | "trades" | "log" | "links";

export const MIN_SHEET_HEIGHT = 160;

export function clampSheetHeight(px: number): number {
  const max = Math.round((window.innerHeight || 800) * 0.75);
  return Math.min(Math.max(Math.round(px), MIN_SHEET_HEIGHT), max);
}

/**
 * The tab bar stays in flow (so the board never reflows); the expanded panel
 * floats above it, overlaying the board. Drag the grip to resize the panel.
 * On wide screens CSS turns this back into an always-open side rail.
 */
export function BottomSheet({ open, onToggle, tab, tabs, onSelect, peekSeat, height, onHeightChange, children }: {
  open: boolean;
  onToggle: () => void;
  tab: SheetTab;
  tabs: { id: SheetTab; label: string }[];
  onSelect: (t: SheetTab) => void;
  peekSeat: number;
  height: number;
  onHeightChange: (px: number) => void;
  children: ReactNode;
}) {
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  const onGripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, startH: height };
  };
  const onGripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onHeightChange(clampSheetHeight(drag.current.startH + (drag.current.startY - e.clientY)));
  };
  const endGrip = () => { drag.current = null; };

  return (
    <div className={`bottom-sheet${open ? "" : " bottom-sheet--collapsed"}`}>
      <div className="sheet-bar">
        <div className="tabs" role="tablist">
          {tabs.map(({ id, label }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => onSelect(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="sheet-toggle" aria-expanded={open}
          aria-label={open ? "Collapse panel" : "Expand panel"}
          onClick={onToggle}>{open ? "⌄" : "⌃"}</button>
      </div>
      {/* Always rendered so the bar's in-flow height is identical open or
          collapsed — the board must not shift when the panel toggles. */}
      <SheetPeek seat={peekSeat} />
      {open && (
        <div className="sheet-panel" style={{ height: `${height}px` }}>
          <div className="sheet-grip" role="separator" aria-orientation="horizontal" aria-label="Resize panel"
            onPointerDown={onGripDown} onPointerMove={onGripMove}
            onPointerUp={endGrip} onPointerCancel={endGrip} />
          <div className="tab-content" role="tabpanel" aria-label={tab}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

import { useId, useState } from "react";
import type { BoardMode } from "../board";

const LAYOUTS: ReadonlyArray<{ mode: BoardMode; name: string; description: string }> = [
  {
    mode: "beginner",
    name: "Beginner",
    description: "A fixed, balanced learning board. Terrain, numbers, and ports are always placed in the same beginner-friendly arrangement.",
  },
  {
    mode: "alphabetical",
    name: "Alphabetical",
    description: "Random terrain and ports with the standard A–R token spiral. The official outside-to-center sequence spreads high-probability numbers more evenly around the board, skipping the desert.",
  },
  {
    mode: "random",
    name: "Random",
    description: "Terrain, ports, and numbers are shuffled freely. Neighboring 6 and 8 tokens are prevented, but every board otherwise feels different.",
  },
];

export function BoardModePicker({ value, onChange, disabled = false }: {
  value: BoardMode;
  onChange: (mode: BoardMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const selected = LAYOUTS.find((layout) => layout.mode === value)!;

  const choose = (mode: BoardMode) => {
    onChange(mode);
    setOpen(false);
  };

  return (
    <section className="board-mode-picker" aria-label="Board layout">
      <button
        type="button"
        className="board-mode-trigger"
        aria-label={`Board layout: ${selected.name}`}
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span><small>Board layout</small><strong>{selected.name}</strong></span>
        <span className="board-mode-chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div id={menuId} className="board-mode-menu">
          {LAYOUTS.map((layout) => (
            <button
              type="button"
              key={layout.mode}
              className={layout.mode === value ? "board-mode-option selected" : "board-mode-option"}
              aria-pressed={layout.mode === value}
              onClick={() => choose(layout.mode)}
            >
              <strong>{layout.name}</strong>
              <span>{layout.description}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

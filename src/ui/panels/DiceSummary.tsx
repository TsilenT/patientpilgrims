import { useEffect, useRef, useState } from "react";
import { useGame } from "../../state/GameProvider";

function diceText(dice?: [number, number]): string {
  if (!dice) return "No roll yet";
  const [a, b] = dice;
  return `${a} + ${b} = ${a + b}`;
}

// Pip layout per face: which cells of a 3×3 grid (0–8) carry a dot.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling, index }: { value: number; rolling: boolean; index: number }) {
  const pips = PIPS[value] ?? [];
  return (
    <span
      className={rolling ? "die die--rolling" : "die"}
      data-testid={`die-${index}`}
      data-value={value}
      style={{ animationDelay: `${index * 80}ms` }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={pips.includes(cell) ? "pip pip--on" : "pip"} />
      ))}
    </span>
  );
}

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DiceSummary() {
  const { state } = useGame();
  const dice = state.turn.dice;
  const key = dice ? `${dice[0]}-${dice[1]}-${state.turn.activeSeat}` : null;

  // Animate whenever a fresh roll lands (including an opponent's roll arriving over the network),
  // but never on the initial mount of an already-rolled game.
  const seen = useRef(key);
  const [rolling, setRolling] = useState(false);
  // While rolling, flash random faces so the dice look like they're tumbling.
  const [flash, setFlash] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (key === null || key === seen.current) return;
    seen.current = key;
    if (prefersReducedMotion()) return;

    setRolling(true);
    const flashId = setInterval(
      () => setFlash([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]),
      70,
    );
    const stopId = setTimeout(() => {
      clearInterval(flashId);
      setFlash(null);
      setRolling(false);
    }, 700); // covers the 0.6s tumble plus the second die's 80ms stagger
    return () => { clearInterval(flashId); clearTimeout(stopId); };
  }, [key]);

  const shown = rolling && flash ? flash : dice;

  return (
    <div className="dice-summary" role="status" aria-label="Dice roll">
      {dice && (
        <span className="dice-faces" aria-hidden="true">
          <Die index={0} value={shown![0]} rolling={rolling} />
          <Die index={1} value={shown![1]} rolling={rolling} />
        </span>
      )}
      <span className="dice-readout">{rolling ? "Rolling…" : diceText(dice)}</span>
    </div>
  );
}

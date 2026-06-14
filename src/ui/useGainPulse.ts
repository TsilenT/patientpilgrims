import { useEffect, useRef, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Resource } from "../engine/types";

type Gain = Partial<Record<Resource, number>>;

/**
 * Resources `seat` just produced on the most recent roll, returned for ~1.5s so the
 * UI can flash a gain, then null. Never fires on mount of an already-rolled game, and
 * fires for any device (your own roll, or an opponent's roll that produced for you).
 */
export function useGainPulse(seat: number): Gain | null {
  const { state } = useGame();
  let rollIdx = -1;
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i]!.type === "roll") { rollIdx = i; break; }
  }

  const seen = useRef<number | null>(null);
  const [gain, setGain] = useState<Gain | null>(null);

  useEffect(() => {
    if (seen.current === null) { seen.current = rollIdx; return; } // skip the initial render
    if (rollIdx === seen.current) return;
    seen.current = rollIdx;
    const g = rollIdx >= 0 ? state.log[rollIdx]!.gains?.[seat] : undefined;
    if (g && Object.keys(g).length > 0) {
      setGain(g);
      const id = setTimeout(() => setGain(null), 1600);
      return () => clearTimeout(id);
    }
    setGain(null);
  }, [rollIdx, seat, state]);

  return gain;
}

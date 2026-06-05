import { useCallback, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Action } from "../engine/types";

/**
 * Dispatch an action and capture a rejected dispatch's error for a Toast.
 * Shared by every component that issues actions (board, action bar, overlays)
 * so the dispatch→check→surface pattern lives in one place.
 */
export function useDispatchWithError(): {
  run: (a: Action) => void;
  error: string | null;
  dismissError: () => void;
} {
  const { dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    (a: Action) => {
      const r = dispatch(a);
      if (!r.ok) setError(r.error);
    },
    [dispatch],
  );
  const dismissError = useCallback(() => setError(null), []);
  return { run, error, dismissError };
}

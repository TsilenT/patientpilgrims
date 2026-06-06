import { useCallback, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Action } from "../engine/types";

/**
 * Dispatch an action and capture a rejected dispatch's error for a Toast.
 * Handles both the hotseat (sync) and networked (promise) dispatch returns.
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
      void Promise.resolve(dispatch(a)).then((r) => {
        if (!r.ok) setError(r.error);
      });
    },
    [dispatch],
  );
  const dismissError = useCallback(() => setError(null), []);
  return { run, error, dismissError };
}

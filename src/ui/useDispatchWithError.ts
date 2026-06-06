import { useCallback, useState } from "react";
import { useGame } from "../state/GameProvider";
import type { Action } from "../engine/types";
import type { DispatchResult } from "../state/store";

/**
 * Dispatch an action and capture a rejected dispatch's error for a Toast.
 * `run` resolves to the DispatchResult so callers can react to success (e.g. exit
 * build mode); callers that ignore the return value behave exactly as before.
 */
export function useDispatchWithError(): {
  run: (a: Action) => Promise<DispatchResult>;
  error: string | null;
  dismissError: () => void;
} {
  const { dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    (a: Action): Promise<DispatchResult> =>
      Promise.resolve(dispatch(a)).then((r) => {
        if (!r.ok) setError(r.error);
        return r;
      }),
    [dispatch],
  );
  const dismissError = useCallback(() => setError(null), []);
  return { run, error, dismissError };
}

import { useCallback, useState } from "react";
import { useGame } from "../../state/GameProvider";
import { Toast } from "../Toast";
import type { Action } from "../../engine/types";

export function ActionBar() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState<string | null>(null);
  const dismiss = useCallback(() => setError(null), []);
  const run = (a: Action) => { const r = dispatch(a); if (!r.ok) setError(r.error); };
  const sub = state.turn.subPhase;

  return (
    <div className="action-bar">
      {sub === "awaitingRoll" && (
        <button onClick={() => run({ type: "rollDice" })}>Roll</button>
      )}
      {sub === "main" && (
        <>
          <button onClick={() => run({ type: "buyDevCard" })}>Buy Dev Card</button>
          <button onClick={() => run({ type: "endTurn" })}>End Turn</button>
        </>
      )}
      <Toast message={error} onDismiss={dismiss} />
    </div>
  );
}

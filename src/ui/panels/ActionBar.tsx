import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";

export function ActionBar() {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;

  return (
    <div className="action-bar">
      {sub === "awaitingRoll" && (
        <button onClick={() => run({ type: "rollDice" })}>Roll</button>
      )}
      {sub === "main" && (
        <>
          <button title="Costs sheep, wheat, ore" onClick={() => run({ type: "buyDevCard" })}>Buy Dev Card</button>
          <button title="Finish your turn and pass to the next player" onClick={() => run({ type: "endTurn" })}>End Turn</button>
        </>
      )}
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

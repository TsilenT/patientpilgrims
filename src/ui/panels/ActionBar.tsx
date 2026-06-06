import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";

function diceText(dice?: [number, number]): string {
  if (!dice) return "No roll yet";
  const [a, b] = dice;
  return `${a} + ${b} = ${a + b}`;
}

export function ActionBar() {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;

  return (
    <div className="action-bar">
      <div className="dice-summary" role="status" aria-label="Dice roll">
        <span>Dice:</span> <strong>{diceText(state.turn.dice)}</strong>
      </div>
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

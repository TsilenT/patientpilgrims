import { useGame } from "../../state/GameProvider";

function diceText(dice?: [number, number]): string {
  if (!dice) return "No roll yet";
  const [a, b] = dice;
  return `${a} + ${b} = ${a + b}`;
}

export function DiceSummary() {
  const { state } = useGame();
  return (
    <div className="dice-summary" role="status" aria-label="Dice roll">
      <span>Dice:</span> <strong>{diceText(state.turn.dice)}</strong>
    </div>
  );
}

import { useGame } from "../../state/GameProvider";

export function GameOverBanner() {
  const { state } = useGame();
  if (state.phase !== "finished" || state.winner === undefined) return null;
  return (
    <div className="game-over" role="dialog" aria-modal="true" aria-label="Game over">
      <h2>{state.players[state.winner]!.name} wins!</h2>
    </div>
  );
}

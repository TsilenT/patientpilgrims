import type { GameState } from "../../engine/types";
export function RobberVictimPicker({ state, victims, onPick }: {
  state: GameState; victims: number[]; onPick: (seat: number) => void;
}) {
  return (
    <div className="robber-victims" role="dialog" aria-modal="true" aria-label="Choose who to rob">
      <p>Steal from:</p>
      {victims.map((s) => (
        <button key={s} onClick={() => onPick(s)}>{state.players[s]!.name}</button>
      ))}
    </div>
  );
}

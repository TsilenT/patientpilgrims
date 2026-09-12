import type { GameState } from "../../engine/types";

function colorLabel(color: string) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export function RobberVictimPicker({ state, victims, onPick }: {
  state: GameState; victims: number[]; onPick: (seat: number) => void;
}) {
  return (
    <div className="robber-victims" role="dialog" aria-modal="true" aria-label="Choose who to rob">
      <p>Steal from:</p>
      <div className="robber-victim-list">
        {victims.map((s) => {
          const player = state.players[s]!;
          return (
            <button className="robber-victim" key={s} onClick={() => onPick(s)}
              aria-label={`${player.name}, ${player.color} player`}>
              <span className="robber-victim-swatch" style={{ background: player.color }} aria-hidden="true" />
              <span className="robber-victim-name">{player.name}</span>
              <span className="robber-victim-color">{colorLabel(player.color)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

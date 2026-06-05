import { useGame } from "../../state/GameProvider";
import { currentActor } from "../../state/viewModel";
import { RESOURCE_LIST } from "../../engine/resources";

export function HandPanel() {
  const { state } = useGame();
  const seat = currentActor(state);
  const me = state.players[seat]!;
  return (
    <div className="hand-panel">
      <h2>{me.name}</h2>
      <ul className="resources">
        {RESOURCE_LIST.map((r) => (
          <li key={r} data-testid={`res-${r}`}>{r}: {me.resources[r]}</li>
        ))}
      </ul>
      <ul className="dev-cards">
        {me.devCards.map((c, i) => (
          <li key={i} data-dev={c.type}>{c.type}</li>
        ))}
      </ul>
    </div>
  );
}

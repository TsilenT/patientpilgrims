import { useState } from "react";
import { canAfford } from "../../engine";
import { DEV_CARD_COST } from "../../engine/devcards";
import { useGame } from "../../state/GameProvider";
import { useDispatchWithError } from "../useDispatchWithError";
import { Toast } from "../Toast";

export function ActionBar({ confirmPurchases = false }: { confirmPurchases?: boolean }) {
  const { state } = useGame();
  const { run, error, dismissError } = useDispatchWithError();
  const sub = state.turn.subPhase;
  const activePlayer = state.players[state.turn.activeSeat]!;
  const canBuyDevCard = canAfford(activePlayer.resources, DEV_CARD_COST);
  const [confirmingDevCard, setConfirmingDevCard] = useState(false);

  if (confirmingDevCard && sub === "main") {
    return (
      <div className="action-bar action-confirm" role="dialog" aria-modal="true" aria-label="Confirm development card purchase">
        <p>Buy a development card?</p>
        <button className="btn-primary" onClick={async () => {
          const result = await run({ type: "buyDevCard" });
          if (result.ok) setConfirmingDevCard(false);
        }}>Confirm</button>
        <button onClick={() => setConfirmingDevCard(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="action-bar">
      {sub === "awaitingRoll" && (
        <button onClick={() => run({ type: "rollDice" })}>Roll</button>
      )}
      {sub === "main" && (
        <>
          <button disabled={!canBuyDevCard} title="Costs sheep, wheat, ore"
            onClick={() => confirmPurchases ? setConfirmingDevCard(true) : run({ type: "buyDevCard" })}>Buy Dev Card</button>
          <button title="Finish your turn and pass to the next player" onClick={() => run({ type: "endTurn" })}>End Turn</button>
        </>
      )}
      <Toast message={error} onDismiss={dismissError} />
    </div>
  );
}

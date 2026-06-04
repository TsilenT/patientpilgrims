import type { GameState, Action, ApplyResult } from "./types";
import type { Rng } from "./rng";
import { applySetupSettlement, applySetupRoad } from "./actions/setup";
import { applyRollDice } from "./actions/roll";
import { checkVictory } from "./scoring/victory";

export function apply(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (state.phase === "finished") return { ok: false, error: "Game is over" };
  const draft = structuredClone(state);
  const error = route(draft, action, rng);
  if (error !== null) return { ok: false, error };
  draft.version += 1;
  checkVictory(draft);
  return { ok: true, state: draft };
}

function route(draft: GameState, action: Action, rng: Rng): string | null {
  switch (action.type) {
    case "setupSettlement":
      return applySetupSettlement(draft, action.vertex);
    case "setupRoad":
      return applySetupRoad(draft, action.edge);
    case "rollDice":
      return applyRollDice(draft, rng);
    default:
      return `Action '${action.type}' is not available yet`;
  }
}

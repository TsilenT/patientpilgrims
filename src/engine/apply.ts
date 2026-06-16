import type { GameState, Action, ApplyResult } from "./types";
import type { Rng } from "./rng";
import { applySetupSettlement, applySetupRoad } from "./actions/setup";
import { applyRollDice } from "./actions/roll";
import { applyBuildRoad, applyBuildSettlement, applyBuildCity } from "./actions/build";
import { applyEndTurn } from "./actions/turn";
import { applyDiscard, applyMoveRobber } from "./actions/robber";
import { applyBuyDevCard, applyPlayMonopoly, applyPlayYearOfPlenty, applyPlayRoadBuilding } from "./actions/dev";
import { applyPlayKnight } from "./actions/knight";
import { applyTradeBank, applyProposeTrade, applyAcceptTrade, applyCancelTrade } from "./actions/trade";
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
    case "buildRoad":
      return applyBuildRoad(draft, action.edge);
    case "buildSettlement":
      return applyBuildSettlement(draft, action.vertex);
    case "buildCity":
      return applyBuildCity(draft, action.vertex);
    case "discard":
      return applyDiscard(draft, action.seat, action.cards);
    case "moveRobber":
      return applyMoveRobber(draft, action.hex, action.victim, rng);
    case "buyDevCard":
      return applyBuyDevCard(draft, rng);
    case "playMonopoly":
      return applyPlayMonopoly(draft, action.resource);
    case "playYearOfPlenty":
      return applyPlayYearOfPlenty(draft, action.resources);
    case "playRoadBuilding":
      return applyPlayRoadBuilding(draft, action.edges);
    case "playKnight":
      return applyPlayKnight(draft);
    case "tradeBank":
      return applyTradeBank(draft, action.give, action.get, action.seat);
    case "proposeTrade":
      return applyProposeTrade(draft, action.give, action.want, action.to, action.seat);
    case "acceptTrade":
      return applyAcceptTrade(draft, action.offerId, action.seat);
    case "cancelTrade":
      return applyCancelTrade(draft, action.offerId, action.seat);
    case "endTurn":
      return applyEndTurn(draft);
  }
}

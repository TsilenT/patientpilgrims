import type { ResourceMap } from "./resources";

export type DevCardType =
  | "knight" | "roadBuilding" | "yearOfPlenty" | "monopoly" | "victoryPoint";

/** Standard base-game development deck (25 cards). */
export function makeDevDeck(): DevCardType[] {
  const deck: DevCardType[] = [];
  for (let i = 0; i < 14; i++) deck.push("knight");
  for (let i = 0; i < 5; i++) deck.push("victoryPoint");
  for (let i = 0; i < 2; i++) deck.push("roadBuilding");
  for (let i = 0; i < 2; i++) deck.push("yearOfPlenty");
  for (let i = 0; i < 2; i++) deck.push("monopoly");
  return deck;
}

export const DEV_CARD_COST: ResourceMap = { wood: 0, brick: 0, sheep: 1, wheat: 1, ore: 1 };

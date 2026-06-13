import type { DevCardType } from "../engine/devcards";

export interface DevCardInfo {
  name: string;
  description: string;
}

/** Player-facing names and descriptions for development cards. Icons: see DEV_CARD_ICON. */
export const DEV_CARD_INFO: Record<DevCardType, DevCardInfo> = {
  knight: {
    name: "Knight",
    description: "Move the robber and steal a card. Play 3 to claim Largest Army (2 VP).",
  },
  roadBuilding: {
    name: "Road Building",
    description: "Build 2 roads for free.",
  },
  yearOfPlenty: {
    name: "Year of Plenty",
    description: "Take any 2 resources from the bank.",
  },
  monopoly: {
    name: "Monopoly",
    description: "Name a resource and take every one your opponents hold.",
  },
  victoryPoint: {
    name: "Victory Point",
    description: "A hidden +1 victory point, revealed when you win.",
  },
};

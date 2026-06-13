import type { DevCardType } from "../engine/devcards";

export interface DevCardInfo {
  name: string;
  icon: string;
  description: string;
}

/** Player-facing presentation for development cards (names, icons, what they do). */
export const DEV_CARD_INFO: Record<DevCardType, DevCardInfo> = {
  knight: {
    name: "Knight",
    icon: "⚔️",
    description: "Move the robber and steal a card. Play 3 to claim Largest Army (2 VP).",
  },
  roadBuilding: {
    name: "Road Building",
    icon: "🛣️",
    description: "Build 2 roads for free.",
  },
  yearOfPlenty: {
    name: "Year of Plenty",
    icon: "🎁",
    description: "Take any 2 resources from the bank.",
  },
  monopoly: {
    name: "Monopoly",
    icon: "💰",
    description: "Name a resource and take every one your opponents hold.",
  },
  victoryPoint: {
    name: "Victory Point",
    icon: "🏆",
    description: "A hidden +1 victory point, revealed when you win.",
  },
};

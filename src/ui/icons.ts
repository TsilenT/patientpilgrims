/** Flat resource icons (colonists.io art direction, per the layout mockup). */
export const RESOURCE_ICON: Record<string, string> = {
  wood: "🌲",
  brick: "🧱",
  sheep: "🐑",
  wheat: "🌾",
  ore: "⛰️",
};

/** Hex face icons — resources plus the desert. */
export const HEX_ICON: Record<string, string> = {
  ...RESOURCE_ICON,
  desert: "🌵",
};

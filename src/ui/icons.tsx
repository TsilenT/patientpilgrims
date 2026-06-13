import type { SVGProps } from "react";
import type { Resource } from "../engine/types";
import type { DevCardType } from "../engine/devcards";

/**
 * One cohesive line-icon set (24×24, currentColor stroke) replacing the emoji
 * the UI used to render. Icons inherit `color` and font-size (default 1em), so
 * they drop in beside text; callers can override `stroke`, `width`/`height`, or
 * pass SVG positioning props (`x`/`y`) for use inside the board's <svg>.
 */
export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ className, children, ...props }: IconProps & { children: React.ReactNode }) {
  // Decorative by default; when a caller supplies an aria-label, expose it as an image instead.
  const labelled = props["aria-label"] != null;
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      className={["icon", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </svg>
  );
}

export type IconComponent = (props: IconProps) => React.ReactElement;

// ---- Resources / hexes ----
export const WoodIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M12 3l5 8h-3l4 7H6l4-7H7z" /><path d="M12 18v3" /></Icon>
);
export const BrickIcon: IconComponent = (p) => (
  <Icon {...p}><rect x="3" y="6" width="18" height="12" rx="1" /><path d="M3 12h18M12 6v6M8 12v6M16 12v6" /></Icon>
);
export const SheepIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M8 15a3 3 0 0 1-1-5.8A3.2 3.2 0 0 1 13 7a2.8 2.8 0 0 1 3 2.5 2.6 2.6 0 0 1-1 5z" />
    <path d="M9 15v3M14 15v3" /><circle cx="17.5" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);
export const WheatIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 21V9" />
    <path d="M12 9c-2-.6-3-2-3-4M12 9c2-.6 3-2 3-4M12 6c-2-.6-3-2-3-4M12 6c2-.6 3-2 3-4M12 13c-2-.6-3.5-1.6-4.5-3.4M12 13c2-.6 3.5-1.6 4.5-3.4" />
  </Icon>
);
export const OreIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M3 19l5-11 4 6 3-4 6 9z" /></Icon>
);
export const DesertIcon: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
  </Icon>
);

// ---- Buildings ----
export const RoadIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M9 21L11 3M15 21L13 3M12 17v-2M12 12v-2M12 7V5" /></Icon>
);
export const SettlementIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /><path d="M10 19v-4h4v4" /></Icon>
);
export const CityIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 21V9l6-3v4l6-4v6h6v9z" />
    <path d="M7 13v1M7 17v1M13 13v1M13 17v1M18 13v1M18 17v1" />
  </Icon>
);

// ---- Development cards ----
export const KnightIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M12 8v6M9.5 11h5" /></Icon>
);
export const GiftIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="10" rx="1" /><path d="M4 14h16M12 10v10" />
    <path d="M12 10C10.5 7.5 7 8 7 10c0 1 2 .8 5 0M12 10c1.5-2.5 5-2 5 0 0 1-2 .8-5 0" />
  </Icon>
);
export const CoinsIcon: IconComponent = (p) => (
  <Icon {...p}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </Icon>
);
export const StarIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16.8 6.4 20l1.6-6.3-5-4.2 6.5-.5z" /></Icon>
);

// ---- Misc UI ----
export const CrownIcon: IconComponent = (p) => (
  <Icon {...p}><path d="M3 8l4 4 5-7 5 7 4-4-1.6 11H4.6z" /><path d="M4.6 19h14.8" /></Icon>
);
export const LinkIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M9.5 14.5l5-5" />
    <path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2M13 18l-1 1a4 4 0 0 1-6-6l2-2" />
  </Icon>
);
export const DiceIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const RESOURCE_ICON: Record<Resource, IconComponent> = {
  wood: WoodIcon,
  brick: BrickIcon,
  sheep: SheepIcon,
  wheat: WheatIcon,
  ore: OreIcon,
};

export const HEX_ICON: Record<string, IconComponent> = {
  ...RESOURCE_ICON,
  desert: DesertIcon,
};

export const DEV_CARD_ICON: Record<DevCardType, IconComponent> = {
  knight: KnightIcon,
  roadBuilding: RoadIcon,
  yearOfPlenty: GiftIcon,
  monopoly: CoinsIcon,
  victoryPoint: StarIcon,
};

export const BUILD_ICON: Record<"road" | "settlement" | "city", IconComponent> = {
  road: RoadIcon,
  settlement: SettlementIcon,
  city: CityIcon,
};

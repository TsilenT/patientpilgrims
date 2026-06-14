import type { SVGProps } from "react";
import type { Resource } from "../engine/types";
import type { DevCardType } from "../engine/devcards";

/**
 * One cohesive flat icon set (24×24) replacing the emoji the UI used to render.
 * Icons carry their own colors so they read on the dark panels; on the board the
 * `.hex-icon` class adds a white halo for contrast over the colored tiles.
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
  <Icon {...p}>
    <rect x="10.7" y="14" width="2.6" height="7" rx="1" fill="#6b4a2b" />
    <path d="M12 3l5.2 8H6.8z" fill="#2f7d44" />
    <path d="M12 8l6 9H6z" fill="#379150" />
  </Icon>
);
export const BrickIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" fill="#cf5a34" />
    <path d="M3 12h18M12 6v6M8 12v6M16 12v6" stroke="#7d3017" strokeWidth="1.4" strokeLinecap="round" fill="none" />
  </Icon>
);
export const SheepIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="8" y="13.5" width="1.8" height="4.5" rx=".9" fill="#4a4f57" />
    <rect x="13.5" y="13.5" width="1.8" height="4.5" rx=".9" fill="#4a4f57" />
    <path d="M7.6 15a3.1 3.1 0 0 1-.5-6.1 3.3 3.3 0 0 1 5.9-1.7 2.9 2.9 0 0 1 2.7 4.5A3 3 0 0 1 14 16z" fill="#eef0ee" />
    <circle cx="16.4" cy="10" r="2" fill="#4a4f57" />
    <circle cx="16" cy="9.4" r=".5" fill="#eef0ee" />
  </Icon>
);
export const WheatIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="11.3" y="11" width="1.4" height="10" rx=".7" fill="#9a7b2e" />
    <g fill="#e6b23c">
      <ellipse cx="12" cy="4.5" rx="1.5" ry="2.4" />
      <ellipse cx="12" cy="9" rx="1.4" ry="2.2" />
      <ellipse cx="9.6" cy="7" rx="1.3" ry="2" transform="rotate(-28 9.6 7)" />
      <ellipse cx="14.4" cy="7" rx="1.3" ry="2" transform="rotate(28 14.4 7)" />
      <ellipse cx="9.6" cy="10.5" rx="1.3" ry="2" transform="rotate(-28 9.6 10.5)" />
      <ellipse cx="14.4" cy="10.5" rx="1.3" ry="2" transform="rotate(28 14.4 10.5)" />
    </g>
  </Icon>
);
export const OreIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 19L9 8l3.5 6L15.5 9 21 19z" fill="#94a1ad" />
    <path d="M9 8l1.7 2.9-1.7.8-1.7-.8z" fill="#eef2f5" />
    <path d="M15.5 9l1.4 2.4-1.4.7-1.4-.7z" fill="#eef2f5" />
  </Icon>
);
export const DesertIcon: IconComponent = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" fill="#f0c64e" />
    <g stroke="#f0c64e" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
    </g>
  </Icon>
);

// ---- Buildings ----
export const RoadIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M8.5 21L10.5 3h3L15.5 21z" fill="#5b6470" />
    <path d="M12 18.4v-2.2M12 12.8v-2.2M12 7.2V5" stroke="#f0c64e" strokeWidth="1.5" strokeLinecap="round" />
  </Icon>
);
export const SettlementIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 4l8.5 6.5H3.5z" fill="#c2532c" />
    <rect x="6" y="10" width="12" height="9.5" fill="#e3d2b3" />
    <rect x="10" y="13.5" width="4" height="6" fill="#6b4a2b" />
  </Icon>
);
export const CityIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 21V11l5.5-2.5v3l6-3v5.5H21V21z" fill="#7f8c99" />
    <g fill="#f2d27a">
      <rect x="5" y="13" width="1.6" height="1.6" /><rect x="5" y="16.6" width="1.6" height="1.6" />
      <rect x="9.6" y="12.6" width="1.6" height="1.6" /><rect x="9.6" y="16.6" width="1.6" height="1.6" />
      <rect x="15.4" y="14.2" width="1.6" height="1.6" /><rect x="18.2" y="14.2" width="1.6" height="1.6" />
      <rect x="15.4" y="17.4" width="1.6" height="1.6" /><rect x="18.2" y="17.4" width="1.6" height="1.6" />
    </g>
  </Icon>
);

// ---- Development cards ----
export const KnightIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 3l7 2.5v5.6c0 4.8-3 7.8-7 9.4-4-1.6-7-4.6-7-9.4V5.5z" fill="#5d6b7d" />
    <path d="M12 7.5v6.4M9.2 10.6h5.6" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" />
  </Icon>
);
export const GiftIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="4.5" y="12" width="15" height="8" rx="1" fill="#c2532c" />
    <rect x="4.5" y="9.5" width="15" height="3" rx=".6" fill="#a8431f" />
    <rect x="10.8" y="9.5" width="2.4" height="10.5" fill="#f2c14e" />
    <path d="M12 9.5C10.6 6.6 6.6 7.4 7.6 9.5M12 9.5c1.4-2.9 5.4-2.1 4.4 0" fill="none" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" />
  </Icon>
);
export const CoinsIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M5.5 11.5v3.4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-3.4" fill="#d39f2e" />
    <ellipse cx="12" cy="11.5" rx="6.5" ry="2.6" fill="#e6b23c" />
    <path d="M5.5 7.8v3.4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V7.8" fill="#e6b23c" />
    <ellipse cx="12" cy="7.8" rx="6.5" ry="2.6" fill="#f2c14e" />
  </Icon>
);
export const StarIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M12 3l2.5 6 6.5.5-5 4.2 1.6 6.3L12 16.8 6.4 20l1.6-6.3-5-4.2 6.5-.5z" fill="#f2c14e" />
  </Icon>
);

// ---- Counters (opponent stats) ----
export const CardsIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="4.5" y="8" width="9.5" height="12.5" rx="1.6" fill="#6f7f96" transform="rotate(-13 9.2 14)" />
    <rect x="9" y="6.5" width="9.5" height="12.5" rx="1.6" fill="#a7b7cc" transform="rotate(10 13.7 12.7)" />
  </Icon>
);
export const DevCardBackIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" fill="#4a3661" />
    <rect x="5" y="3.5" width="14" height="17" rx="2" fill="none" stroke="#6f5189" strokeWidth="1.2" />
    <path d="M12 8l1.3 3 3.2.3-2.4 2.1.8 3.1L12 15l-2.9 1.6.8-3.1L7.5 11.3l3.2-.3z" fill="#e8c24e" />
  </Icon>
);

// ---- Misc UI ----
export const CrownIcon: IconComponent = (p) => (
  <Icon {...p}>
    <path d="M3 8l4 4 5-7 5 7 4-4-1.6 11H4.6z" fill="#f2c14e" />
    <rect x="4.4" y="18.6" width="15.2" height="2.2" rx="1" fill="#dca82f" />
  </Icon>
);
export const LinkIcon: IconComponent = (p) => (
  <Icon {...p}>
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2M13 18l-1 1a4 4 0 0 1-6-6l2-2" />
    </g>
  </Icon>
);
export const DiceIcon: IconComponent = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="15" cy="15" r="1.2" fill="currentColor" />
  </Icon>
);

/** A resource icon on its colored tile (matches the board hexes / hand chips). */
export function ResTile({ r }: { r: Resource }) {
  const Icon = RESOURCE_ICON[r];
  return <span className="res-tile" data-res={r}><Icon /></span>;
}

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

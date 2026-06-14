import { DEV_CARD_COST } from "../../engine/devcards";
import { COSTS, RESOURCE_LIST, type ResourceMap } from "../../engine/resources";
import { ResTile } from "../icons";
import type { Player } from "../../engine/types";

type CostItem = {
  label: string;
  cost: ResourceMap;
  title: string;
  remaining: (player: Player, devDeckLeft: number) => number;
};

const COST_ITEMS: CostItem[] = [
  {
    label: "Road",
    cost: COSTS.road,
    title: "Build a road on a legal edge. Costs wood, brick.",
    remaining: (player) => player.pieces.roads,
  },
  {
    label: "Settlement",
    cost: COSTS.settlement,
    title: "Build a settlement on a legal vertex connected to your road network. Costs wood, brick, sheep, wheat.",
    remaining: (player) => player.pieces.settlements,
  },
  {
    label: "City Upgrade",
    cost: COSTS.city,
    title: "Upgrade one settlement to a city. Costs 2 wheat, 3 ore.",
    remaining: (player) => player.pieces.cities,
  },
  {
    label: "Dev Card",
    cost: DEV_CARD_COST,
    title: "Buy a development card. Costs sheep, wheat, ore.",
    remaining: (_player, devDeckLeft) => devDeckLeft,
  },
];

export function CostReference({ player, devDeckLeft }: { player: Player; devDeckLeft: number }) {
  return (
    <section className="cost-reference" role="region" aria-label="Cost reference">
      <h3>Costs</h3>
      <ul>
        {COST_ITEMS.map((item) => (
          <li key={item.label} title={item.title}>
            <span className="cost-label">{`${item.label} (${item.remaining(player, devDeckLeft)} left)`}</span>
            <span className="cost-tiles">
              {RESOURCE_LIST.flatMap((r) =>
                Array.from({ length: item.cost[r] }, (_, i) => <ResTile key={`${r}${i}`} r={r} />),
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

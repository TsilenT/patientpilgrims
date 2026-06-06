import { DEV_CARD_COST } from "../../engine/devcards";
import { COSTS, RESOURCE_LIST, type ResourceMap } from "../../engine/resources";

type CostItem = {
  label: string;
  cost: ResourceMap;
  title: string;
};

const COST_ITEMS: CostItem[] = [
  {
    label: "Road",
    cost: COSTS.road,
    title: "Build a road on a legal edge. Costs wood, brick.",
  },
  {
    label: "Settlement",
    cost: COSTS.settlement,
    title: "Build a settlement on a legal vertex connected to your road network. Costs wood, brick, sheep, wheat.",
  },
  {
    label: "City upgrade",
    cost: COSTS.city,
    title: "Upgrade one settlement to a city. Costs 2 wheat, 3 ore.",
  },
  {
    label: "Dev card",
    cost: DEV_CARD_COST,
    title: "Buy a development card. Costs sheep, wheat, ore.",
  },
];

function formatCost(cost: ResourceMap): string {
  const parts = RESOURCE_LIST
    .filter((r) => cost[r] > 0)
    .map((r) => (cost[r] === 1 ? r : `${cost[r]} ${r}`));
  return parts.join(" + ");
}

export function CostReference() {
  return (
    <section className="cost-reference" role="region" aria-label="Cost reference">
      <h3>Costs</h3>
      <ul>
        {COST_ITEMS.map((item) => (
          <li key={item.label} title={item.title}>
            <span className="cost-label">{item.label}</span>
            <span className="cost-value">{formatCost(item.cost)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

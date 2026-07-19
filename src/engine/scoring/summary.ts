import type { GameState, LogEntry } from "../types";
import { RESOURCE_LIST } from "../resources";
import { totalVictoryPoints } from "./victory";

export interface PlayerSummary {
  seat: number;
  name: string;
  color: string;
  /** 1-based; ties share the better rank. */
  rank: number;
  /** Includes hidden victory-point dev cards — the game is over. */
  totalVp: number;
  breakdown: {
    settlements: number;
    cities: number;
    vpCards: number;
    largestArmy: boolean;
    longestRoad: boolean;
  };
  title: { text: string; detail: string };
}

export interface GameSummary {
  winner: number;
  standings: PlayerSummary[];
  otherStats: PlayerOtherStats[];
  resourceHistory: PlayerResourceHistory[];
  /** False when a pre-history non-7 roll cannot prove whether production occurred. */
  resourceHistoryComplete: boolean;
}

export interface PlayerResourceHistory {
  seat: number;
  name: string;
  color: string;
  /** Cumulative production plus robber thefts, minus resources stolen away, after each log entry. */
  values: number[];
}

export interface PlayerOtherStats {
  seat: number;
  name: string;
  color: string;
  resourcesBlocked: number;
  resourcesStolen: number;
  resourcesStolenFrom: number;
  resourcesDiscarded: number;
  sevensRolled: number;
  trades: number;
  builds: number;
  devCardsBought: number;
}

interface CourtTitle {
  text: string;
  metric: (state: GameState, seat: number) => number;
  detail: (n: number) => string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const countLog = (state: GameState, seat: number, pred: (e: LogEntry) => boolean) =>
  state.log.filter((e) => e.seat === seat && pred(e)).length;

/** Priority-ordered; each goes to the unassigned non-winner with the strict max metric (> 0). */
const COURT_TITLES: CourtTitle[] = [
  {
    text: "Lord Commander of the Army",
    metric: (s, seat) => s.players[seat]!.knightsPlayed,
    detail: (n) => `${plural(n, "knight")} led to battle`,
  },
  {
    text: "Warden of the King's Roads",
    metric: (s, seat) => s.players[seat]!.longestRoadLength,
    detail: (n) => `a road ${n} segments long`,
  },
  {
    text: "Master of Coin",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "proposeTrade" || e.type === "tradeBank"),
    detail: (n) => `${plural(n, "deal")} brokered`,
  },
  {
    text: "Court Wizard",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "buyDevCard"),
    detail: (n) => `${plural(n, "scroll")} studied`,
  },
  {
    text: "Shadow of the Realm",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "steal"),
    detail: (n) => plural(n, "daring heist"),
  },
  {
    text: "Herald of Misfortune",
    metric: (s, seat) => countLog(s, seat, (e) => e.type === "roll" && e.sum === 7),
    detail: (n) => `summoned the robber ${n === 1 ? "once" : `${n} times`}`,
  },
  {
    text: "Martyr of the Treasury",
    metric: (s, seat) =>
      s.log
        .filter((e) => e.seat === seat && e.type === "discard")
        .reduce((total, e) => total + (e.count ?? 0), 0),
    detail: (n) => `${plural(n, "card")} tithed to the crown`,
  },
  {
    text: "Master Builder of the Realm",
    metric: (s, seat) =>
      countLog(s, seat, (e) => e.type === "buildSettlement" || e.type === "buildCity" || e.type === "setupSettlement"),
    detail: (n) => `${plural(n, "great work")} raised`,
  },
];

/** Everything the win screen shows, derived once from the finished state. */
export function gameSummary(state: GameState): GameSummary {
  const winner = state.winner!;
  const totals = state.players.map((p) => totalVictoryPoints(state, p.seat));

  const order = state.players
    .map((p) => p.seat)
    .sort((a, b) => totals[b]! - totals[a]! || (a === winner ? -1 : b === winner ? 1 : a - b));

  const rankBySeat = new Map<number, number>();
  order.forEach((seat, i) => {
    const ahead = order[i - 1];
    rankBySeat.set(seat, i > 0 && totals[seat] === totals[ahead!] ? rankBySeat.get(ahead!)! : i + 1);
  });

  const titles = new Map<number, { text: string; detail: string }>();
  titles.set(winner, { text: "Sovereign of the Realm", detail: "first of their name" });
  for (const t of COURT_TITLES) {
    let bestSeat = -1;
    let bestVal = 0;
    for (const p of state.players) {
      if (titles.has(p.seat)) continue;
      const v = t.metric(state, p.seat);
      if (v > bestVal) { bestVal = v; bestSeat = p.seat; }
    }
    if (bestSeat >= 0) titles.set(bestSeat, { text: t.text, detail: t.detail(bestVal) });
  }
  order.forEach((seat, i) => {
    if (titles.has(seat)) return;
    const rank = rankBySeat.get(seat)!;
    titles.set(
      seat,
      i === order.length - 1 ? { text: "Court Jester", detail: "beloved by the court all the same" }
      : rank === 2 ? { text: "Heir to the Throne", detail: "the realm's second choice" }
      : rank === 3 ? { text: "Royal Chancellor", detail: "keeper of the royal ledgers" }
      : { text: "Noble of the Realm", detail: "steadfast and true" },
    );
  });

  const standings = order.map((seat) => {
    const p = state.players[seat]!;
    let settlements = 0;
    let cities = 0;
    for (const b of Object.values(state.board.buildings)) {
      if (b.owner !== seat) continue;
      if (b.type === "city") cities++; else settlements++;
    }
    return {
      seat,
      name: p.name,
      color: p.color,
      rank: rankBySeat.get(seat)!,
      totalVp: totals[seat]!,
      breakdown: {
        settlements,
        cities,
        vpCards: p.devCards.filter((c) => c.type === "victoryPoint").length,
        largestArmy: state.awards.largestArmy === seat,
        longestRoad: state.awards.longestRoad === seat,
      },
      title: titles.get(seat)!,
    };
  });

  const otherStats = state.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    color: p.color,
    resourcesBlocked: state.log.reduce((n, e) => n + (e.blocked?.[p.seat] ?? 0), 0),
    resourcesStolen: countLog(state, p.seat, (e) => e.type === "steal"),
    resourcesStolenFrom: state.log.filter((e) => e.type === "steal" && e.victim === p.seat).length,
    resourcesDiscarded: state.log.filter((e) => e.seat === p.seat && e.type === "discard").reduce((n, e) => n + (e.count ?? 0), 0),
    sevensRolled: countLog(state, p.seat, (e) => e.type === "roll" && e.sum === 7),
    trades: countLog(state, p.seat, (e) => e.type === "tradeBank" || e.type === "proposeTrade"),
    builds: countLog(state, p.seat, (e) => e.type === "buildRoad" || e.type === "buildSettlement" || e.type === "buildCity"),
    devCardsBought: countLog(state, p.seat, (e) => e.type === "buyDevCard"),
  }));

  const resourceHistoryComplete = state.log.every((entry) => {
    if (entry.type === "roll" && entry.sum !== 7) return entry.gains !== undefined;
    if (entry.type === "playMonopoly" && (entry.count ?? 0) > 0) return entry.monopolyStolen !== undefined;
    return true;
  });
  const resourceTotals = state.players.map(() => 0);
  const resourceHistory: PlayerResourceHistory[] = state.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    color: p.color,
    values: [0],
  }));
  for (const entry of state.log) {
    if (entry.type === "roll" && entry.gains) {
      for (const p of state.players) {
        const gains = entry.gains[p.seat];
        if (!gains) continue;
        resourceTotals[p.seat] = (resourceTotals[p.seat] ?? 0) + RESOURCE_LIST.reduce(
          (total, resource) => total + (gains[resource] ?? 0),
          0,
        );
      }
    } else if (entry.type === "steal" && entry.victim !== undefined) {
      resourceTotals[entry.seat] = (resourceTotals[entry.seat] ?? 0) + 1;
      resourceTotals[entry.victim] = (resourceTotals[entry.victim] ?? 0) - 1;
    } else if (entry.type === "playMonopoly") {
      if (entry.monopolyStolen) {
        let taken = 0;
        for (const [victimText, amount] of Object.entries(entry.monopolyStolen)) {
          const victim = Number(victimText);
          taken += amount;
          resourceTotals[victim] = (resourceTotals[victim] ?? 0) - amount;
        }
        resourceTotals[entry.seat] = (resourceTotals[entry.seat] ?? 0) + taken;
      } else {
        // Older entries recorded only the actor's total; the completeness warning
        // explains that exact victim histories are unavailable.
        resourceTotals[entry.seat] = (resourceTotals[entry.seat] ?? 0) + (entry.count ?? 0);
      }
    }
    for (const p of state.players) resourceHistory[p.seat]!.values.push(resourceTotals[p.seat]!);
  }

  return { winner, standings, otherStats, resourceHistory, resourceHistoryComplete };
}

import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { gameSummary } from "../../src/engine/scoring/summary";
import type { GameState } from "../../src/engine/types";

const players3 = [
  { name: "Alice", color: "red" },
  { name: "Bob", color: "blue" },
  { name: "Carol", color: "white" },
];

/** Finished game, Alice (seat 0) winning 10–7–5, empty log. */
function finished(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "finished";
  g.winner = 0;
  delete g.setup;
  g.players[0]!.victoryPoints = 10;
  g.players[1]!.victoryPoints = 7;
  g.players[2]!.victoryPoints = 5;
  return g;
}

describe("standings", () => {
  it("sorts by total VP and assigns ranks", () => {
    const s = gameSummary(finished());
    expect(s.winner).toBe(0);
    expect(s.standings.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(s.standings.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(s.standings.map((p) => p.totalVp)).toEqual([10, 7, 5]);
  });

  it("reveals hidden victory-point dev cards in totals", () => {
    const g = finished();
    g.players[1]!.devCards = [
      { type: "victoryPoint", boughtThisTurn: false, played: false },
      { type: "victoryPoint", boughtThisTurn: false, played: false },
    ];
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.totalVp).toBe(9);
    expect(s.standings.find((p) => p.seat === 1)!.breakdown.vpCards).toBe(2);
  });

  it("puts the winner first when totals tie", () => {
    const g = finished();
    g.players[1]!.victoryPoints = 10;
    const s = gameSummary(g);
    expect(s.standings[0]!.seat).toBe(0);
    expect(s.standings[0]!.rank).toBe(1);
    expect(s.standings[1]!.rank).toBe(1); // ties share the better rank
  });

  it("counts buildings and awards in the breakdown", () => {
    const g = finished();
    g.board.buildings["x1"] = { owner: 0, type: "settlement" };
    g.board.buildings["x2"] = { owner: 0, type: "city" };
    g.awards.largestArmy = 0;
    const b = gameSummary(g).standings.find((p) => p.seat === 0)!.breakdown;
    expect(b).toEqual({ settlements: 1, cities: 1, vpCards: 0, largestArmy: true, longestRoad: false });
  });
});

describe("court titles", () => {
  it("always crowns the winner Sovereign of the Realm", () => {
    const s = gameSummary(finished());
    expect(s.standings.find((p) => p.seat === 0)!.title).toEqual({
      text: "Sovereign of the Realm",
      detail: "first of their name",
    });
  });

  it("awards stat titles by priority, one per player, winner excluded", () => {
    const g = finished();
    g.players[0]!.knightsPlayed = 9; // winner never takes a court title
    g.players[1]!.knightsPlayed = 3;
    g.players[1]!.longestRoadLength = 8;
    g.players[2]!.longestRoadLength = 5;
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.title).toEqual({
      text: "Lord Commander of the Army",
      detail: "3 knights led to battle",
    });
    expect(s.standings.find((p) => p.seat === 2)!.title).toEqual({
      text: "Warden of the King's Roads",
      detail: "a road 5 segments long",
    });
  });

  it("breaks metric ties toward the lower seat", () => {
    const g = finished();
    g.players[1]!.knightsPlayed = 2;
    g.players[2]!.knightsPlayed = 2;
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 1)!.title.text).toBe("Lord Commander of the Army");
  });

  it("sums discarded cards from the log for Martyr of the Treasury", () => {
    const g = finished();
    g.log.push({ type: "discard", seat: 2, count: 4 }, { type: "discard", seat: 2, count: 3 });
    const s = gameSummary(g);
    expect(s.standings.find((p) => p.seat === 2)!.title).toEqual({
      text: "Martyr of the Treasury",
      detail: "7 cards tithed to the crown",
    });
  });

  it("falls back to rank titles when no stats stand out", () => {
    const s = gameSummary(finished()); // empty log, zero metrics
    expect(s.standings.find((p) => p.seat === 1)!.title.text).toBe("Heir to the Throne");
    expect(s.standings.find((p) => p.seat === 2)!.title.text).toBe("Court Jester"); // last place
  });
});

describe("other statistics", () => {
  it("totals resources blocked, stolen, discarded, sevens, trades, builds, and dev cards by player", () => {
    const g = finished();
    g.log.push(
      { type: "roll", seat: 0, dice: [3, 3], sum: 6, blocked: { 0: 1, 1: 2 } },
      { type: "roll", seat: 1, dice: [3, 4], sum: 7 },
      { type: "steal", seat: 0, victim: 1, resource: "wood" },
      { type: "discard", seat: 1, count: 4 },
      { type: "tradeBank", seat: 2, resource: "ore" },
      { type: "proposeTrade", seat: 2 },
      { type: "buildRoad", seat: 2, edge: "e1" },
      { type: "buyDevCard", seat: 2 },
    );
    expect(gameSummary(g).otherStats).toEqual([
      expect.objectContaining({ seat: 0, resourcesBlocked: 1, resourcesStolen: 1, resourcesDiscarded: 0, sevensRolled: 0 }),
      expect.objectContaining({ seat: 1, resourcesBlocked: 2, resourcesStolen: 0, resourcesStolenFrom: 1, resourcesDiscarded: 4, sevensRolled: 1 }),
      expect.objectContaining({ seat: 2, trades: 2, builds: 1, devCardsBought: 1 }),
    ]);
  });
});

describe("resource history", () => {
  it("tracks production and both sides of robber steals without charging trades or builds", () => {
    const g = finished();
    g.log.push(
      { type: "roll", seat: 0, dice: [3, 3], sum: 6, gains: { 0: { wood: 2 }, 1: { ore: 1 } } },
      { type: "buildRoad", seat: 0, edge: "e1" },
      { type: "tradeBank", seat: 1, resource: "ore" },
      { type: "proposeTrade", seat: 1 },
      { type: "acceptTrade", seat: 0 },
      { type: "steal", seat: 0, victim: 1, resource: "ore" },
      { type: "roll", seat: 2, dice: [4, 4], sum: 8, gains: { 1: { brick: 2 }, 2: { wheat: 1, sheep: 1 } } },
    );

    const histories = gameSummary(g).resourceHistory;
    expect(histories.find((p) => p.seat === 0)!.values).toEqual([0, 2, 2, 2, 2, 2, 3, 3]);
    expect(histories.find((p) => p.seat === 1)!.values).toEqual([0, 1, 1, 1, 1, 1, 0, 2]);
    expect(histories.find((p) => p.seat === 2)!.values).toEqual([0, 0, 0, 0, 0, 0, 0, 2]);
    expect(gameSummary(g).resourceHistoryComplete).toBe(true);
  });

  it("tracks Monopoly gains and each victim's losses", () => {
    const g = finished();
    g.log.push({
      type: "playMonopoly",
      seat: 0,
      resource: "brick",
      count: 5,
      monopolyStolen: { 1: 3, 2: 2 },
    });

    const summary = gameSummary(g);
    expect(summary.resourceHistory.find((p) => p.seat === 0)!.values).toEqual([0, 5]);
    expect(summary.resourceHistory.find((p) => p.seat === 1)!.values).toEqual([0, -3]);
    expect(summary.resourceHistory.find((p) => p.seat === 2)!.values).toEqual([0, -2]);
    expect(summary.resourceHistoryComplete).toBe(true);
  });

  it("marks older logs with ambiguous missing production or Monopoly victim data as incomplete", () => {
    const g = finished();
    g.log.push(
      { type: "roll", seat: 0, dice: [3, 3], sum: 6 },
      { type: "roll", seat: 1, dice: [3, 4], sum: 7 },
      { type: "playMonopoly", seat: 0, resource: "brick", count: 5 },
    );

    const summary = gameSummary(g);
    expect(summary.resourceHistoryComplete).toBe(false);
    expect(summary.resourceHistory.find((p) => p.seat === 0)!.values.at(-1)).toBe(5);
  });
});

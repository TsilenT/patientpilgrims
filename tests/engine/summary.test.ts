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

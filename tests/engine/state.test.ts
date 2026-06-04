import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame, snakeOrder } from "../../src/engine/state";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

describe("createInitialGame", () => {
  it("snakeOrder is forward then reverse", () => {
    expect(snakeOrder(3)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(snakeOrder(4)).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
  });

  it("sets up players in the setup phase", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
    expect(g.phase).toBe("setup");
    expect(g.turn).toEqual({ activeSeat: 0, subPhase: "setupSettlement" });
    expect(g.players).toHaveLength(3);
    expect(g.players[0]!.pieces).toEqual({ roads: 15, settlements: 5, cities: 4 });
    expect(g.players[0]!.resources).toEqual({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
    expect(g.bank.wood).toBe(19);
    expect(g.setup).toEqual({ order: [0, 1, 2, 2, 1, 0], pos: 0 });
    expect(Object.keys(g.board.tiles)).toHaveLength(19);
    expect(g.version).toBe(0);
  });

  it("rejects fewer than 3 players", () => {
    expect(() =>
      createInitialGame([{ name: "A", color: "red" }, { name: "B", color: "blue" }],
        createBoard({ mode: "beginner" })),
    ).toThrow();
  });

  it("does not alias the source board", () => {
    const board = createBoard({ mode: "beginner" });
    const g = createInitialGame(players3, board);
    g.board.robber = "mutated";
    expect(board.robber).not.toBe("mutated");
  });
});

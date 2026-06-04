import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { makeDevDeck } from "../../src/engine/devcards";

const players3 = [
  { name: "A", color: "red" },
  { name: "B", color: "blue" },
  { name: "C", color: "white" },
];

describe("dev deck", () => {
  it("makeDevDeck has the 25 standard cards", () => {
    const deck = makeDevDeck();
    expect(deck).toHaveLength(25);
    const count = (t: string) => deck.filter((c) => c === t).length;
    expect(count("knight")).toBe(14);
    expect(count("victoryPoint")).toBe(5);
    expect(count("roadBuilding")).toBe(2);
    expect(count("yearOfPlenty")).toBe(2);
    expect(count("monopoly")).toBe(2);
  });

  it("a new game seeds the deck and gives every player an empty dev-card hand", () => {
    const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
    expect(g.devDeck).toHaveLength(25);
    for (const p of g.players) expect(p.devCards).toEqual([]);
  });
});

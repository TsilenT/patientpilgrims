// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStoragePersistence } from "../../src/state/persistence";
import { createInitialGame } from "../../src/engine";
import { createBoard } from "../../src/board";

const players = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function game() { return createInitialGame(players, createBoard({ mode: "beginner" })); }

describe("LocalStoragePersistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved game", async () => {
    const p = new LocalStoragePersistence();
    const g = game();
    await p.save(g);
    const loaded = await p.load();
    expect(loaded).toEqual(g);
  });

  it("returns null when nothing is saved", async () => {
    expect(await new LocalStoragePersistence().load()).toBeNull();
  });

  it("returns null on a corrupt blob instead of throwing", async () => {
    localStorage.setItem("adultingcatan:game", "{not json");
    expect(await new LocalStoragePersistence().load()).toBeNull();
  });

  it("clear() removes the saved game", async () => {
    const p = new LocalStoragePersistence();
    await p.save(game());
    await p.clear();
    expect(await p.load()).toBeNull();
  });
});

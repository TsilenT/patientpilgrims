import { describe, it, expect } from "vitest";
import { createBoard, type Board } from "../../src/board";
import { mulberry32 } from "../../src/engine/rng";

function assertWellFormed(board: Board): void {
  expect(board.topology.hexIds).toHaveLength(19);
  expect(board.topology.vertexIds).toHaveLength(54);
  expect(board.topology.edgeIds).toHaveLength(72);
  expect(Object.keys(board.tiles)).toHaveLength(19);
  expect(board.ports).toHaveLength(9);
  expect(board.topology.hexIds).toContain(board.robber); // robber on a real hex
}

describe("createBoard", () => {
  it("creates a random board deterministically from an rng", () => {
    const a = createBoard({ mode: "random", rng: mulberry32(5) });
    const b = createBoard({ mode: "random", rng: mulberry32(5) });
    assertWellFormed(a);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.ports).toEqual(b.ports);
  });

  it("randomizes port kinds for random boards", () => {
    const beginner = createBoard({ mode: "beginner" });
    const random = createBoard({ mode: "random", rng: mulberry32(5) });
    expect(random.ports.map((p) => p.edge)).toEqual(beginner.ports.map((p) => p.edge));
    expect(random.ports.map((p) => p.kind).sort()).toEqual(beginner.ports.map((p) => p.kind).sort());
    expect(random.ports.map((p) => p.kind)).not.toEqual(beginner.ports.map((p) => p.kind));
  });

  it("creates the fixed beginner board", () => {
    const a = createBoard({ mode: "beginner" });
    assertWellFormed(a);
    expect(a.tiles).toEqual(createBoard({ mode: "beginner" }).tiles);
  });
});

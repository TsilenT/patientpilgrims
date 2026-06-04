import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng";
import { generateRandomBoard, beginnerBoard, type TileAssignment } from "../../src/board/generate";
import { buildTopology } from "../../src/board/topology";
import { PIP } from "../../src/board/constants";

const topo = buildTopology();

function check(board: TileAssignment): void {
  expect(Object.keys(board.tiles)).toHaveLength(19);
  const kinds = Object.values(board.tiles).map((t) => t.kind);
  expect(kinds.filter((k) => k === "desert")).toHaveLength(1);
  // exactly the 18 non-desert hexes have numbers
  const numbered = Object.values(board.tiles).filter((t) => t.number !== undefined);
  expect(numbered).toHaveLength(18);
  // desert has the robber, and no number
  const desert = Object.entries(board.tiles).find(([, t]) => t.kind === "desert")!;
  expect(board.robber).toBe(desert[0]);
  expect(desert[1].number).toBeUndefined();
}

function noAdjacentReds(board: TileAssignment): boolean {
  for (const hid of topo.hexIds) {
    const n = board.tiles[hid]!.number;
    if (n === undefined || PIP[n] !== 5) continue;
    for (const other of topo.hexIds) {
      if (other === hid) continue;
      const shareEdge = topo.hexEdges.get(hid)!.some((e) => topo.hexEdges.get(other)!.includes(e));
      if (!shareEdge) continue;
      const m = board.tiles[other]!.number;
      if (m !== undefined && PIP[m] === 5) return false;
    }
  }
  return true;
}

describe("generateRandomBoard", () => {
  it("produces a structurally valid board", () => {
    check(generateRandomBoard(mulberry32(1)));
  });

  it("is deterministic for a seed", () => {
    expect(generateRandomBoard(mulberry32(99))).toEqual(generateRandomBoard(mulberry32(99)));
  });

  it("never places two red (6/8) tokens on adjacent hexes", () => {
    for (let seed = 0; seed < 25; seed++) {
      expect(noAdjacentReds(generateRandomBoard(mulberry32(seed)))).toBe(true);
    }
  });
});

describe("beginnerBoard", () => {
  it("is a valid, fixed board", () => {
    check(beginnerBoard());
    expect(beginnerBoard()).toEqual(beginnerBoard());
  });
});

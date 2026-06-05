import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import {
  createInitialGame, apply, topology,
  legalSetupSettlements, legalSetupRoads, legalSettlements, legalCities, legalRoads,
  canAfford, COSTS,
  type GameState, type Action,
} from "../../src/engine";
import { mulberry32, type Rng } from "../../src/engine/rng";

// Pick the seed that converges, verified in Step 5.
const SEED = 3;

function ok(s: GameState, a: Action, rng: Rng): GameState {
  const r = apply(s, a, rng);
  if (!r.ok) throw new Error(`action ${a.type} failed: ${r.error}`);
  return r.state;
}

/** Among candidate vertices, the one touching the most distinct resources. */
function bestSettlement(s: GameState, candidates: string[]): string {
  let best = candidates[0]!;
  let bestScore = -1;
  for (const v of candidates) {
    const kinds = new Set<string>();
    for (const h of topology().vertexHexes.get(v) ?? []) {
      const t = s.board.tiles[h]!;
      if (t.kind !== "desert") kinds.add(t.kind);
    }
    if (kinds.size > bestScore) {
      bestScore = kinds.size;
      best = v;
    }
  }
  return best;
}

/** Prefer a road that opens a new distance-legal settlement spot. */
function pickRoad(s: GameState, roads: string[]): string {
  for (const e of roads) {
    for (const v of topology().edgeVertices.get(e)!) {
      if (s.board.buildings[v] !== undefined) continue;
      const neighbors = topology().vertexNeighbors.get(v)!;
      if (neighbors.every((n) => s.board.buildings[n] === undefined)) return e;
    }
  }
  return roads[0]!;
}

function runSetup(s: GameState, rng: Rng): GameState {
  while (s.phase === "setup") {
    const v = bestSettlement(s, legalSetupSettlements(s.board));
    s = ok(s, { type: "setupSettlement", vertex: v }, rng);
    const e = legalSetupRoads(s.board, v)[0]!;
    s = ok(s, { type: "setupRoad", edge: e }, rng);
  }
  return s;
}

function takeTurn(s: GameState, rng: Rng): GameState {
  s = ok(s, { type: "rollDice" }, rng);
  // A 7 sends the turn to "movingRobber". This full-game smoke test is about reaching a
  // 10-VP win via production/building, not robber fidelity (that is covered exhaustively in
  // robber.test.ts), so we resolve the robber instantly test-side rather than driving the
  // real moveRobber/discard actions here.
  if (s.turn.subPhase === "movingRobber") {
    s.turn.subPhase = "main";
    delete s.discardObligations;
  }
  let acted = true;
  while (acted && s.phase === "main" && s.turn.subPhase === "main") {
    acted = false;
    const seat = s.turn.activeSeat;
    const p = s.players[seat]!;
    const cities = legalCities(s.board, seat);
    if (p.pieces.cities > 0 && canAfford(p.resources, COSTS.city) && cities.length) {
      s = ok(s, { type: "buildCity", vertex: cities[0]! }, rng);
      acted = true;
      continue;
    }
    const setts = legalSettlements(s.board, seat);
    if (p.pieces.settlements > 0 && canAfford(p.resources, COSTS.settlement) && setts.length) {
      s = ok(s, { type: "buildSettlement", vertex: bestSettlement(s, setts) }, rng);
      acted = true;
      continue;
    }
    const roads = legalRoads(s.board, seat);
    if (p.pieces.roads > 0 && canAfford(p.resources, COSTS.road) && roads.length) {
      s = ok(s, { type: "buildRoad", edge: pickRoad(s, roads) }, rng);
      acted = true;
      continue;
    }
  }
  if (s.phase === "finished") return s;
  return ok(s, { type: "endTurn" }, rng);
}

describe("full game scenario", () => {
  it("drives setup -> production -> building to a settlement/city-only 10-VP win", () => {
    const rng = mulberry32(SEED);
    let s = createInitialGame(
      [
        { name: "A", color: "red" },
        { name: "B", color: "blue" },
        { name: "C", color: "white" },
      ],
      createBoard({ mode: "beginner" }),
    );

    s = runSetup(s, rng);
    expect(s.phase).toBe("main");

    let guard = 0;
    while (s.phase !== "finished" && guard < 20000) {
      s = takeTurn(s, rng);
      guard++;
    }

    expect(s.phase).toBe("finished");
    expect(s.winner).not.toBeUndefined();
    const winnerVp = s.players[s.winner!]!.victoryPoints;
    expect(winnerVp).toBeGreaterThanOrEqual(10);

    // VP comes from buildings plus the Longest Road award (+2) once it is wired in.
    // (No dev cards / Largest Army are exercised by this bot, so those are the only sources.)
    let counted = 0;
    for (const b of Object.values(s.board.buildings)) {
      if (b.owner === s.winner) counted += b.type === "city" ? 2 : 1;
    }
    if (s.awards.longestRoad === s.winner) counted += 2;
    expect(counted).toBe(winnerVp);
  });
});

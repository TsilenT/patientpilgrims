import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";
import type { Rng } from "../../src/engine/rng";
import { recomputeVictoryPoints } from "../../src/engine/scoring/victory";

const players3 = [
  { name: "A", color: "red" }, { name: "B", color: "blue" }, { name: "C", color: "white" },
];
function rngOf(...vals: number[]): Rng {
  const q = [...vals];
  return { nextFloat: () => 0, nextInt: () => q.shift() ?? 0, shuffle: (a) => a };
}
function mainGame(): GameState {
  const g = createInitialGame(players3, createBoard({ mode: "beginner" }));
  g.phase = "main"; g.turn = { activeSeat: 0, subPhase: "main" }; delete g.setup;
  return g;
}
function expectOk(r: { ok: boolean }): asserts r is { ok: true; state: GameState } {
  expect(r.ok).toBe(true);
}
/** A target hex distinct from the robber, with no opponent buildings (no victim needed). */
function emptyTargetHex(g: GameState): string {
  return topology().hexIds.find((h) => h !== g.board.robber)!;
}

describe("Largest-Army scoring", () => {
  it("awards +2 VP to the seat holding largestArmy", () => {
    const state = mainGame();
    state.awards.largestArmy = 0;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(2);
  });

  it("removes the +2 VP when the largestArmy award is cleared", () => {
    const state = mainGame();
    state.awards.largestArmy = 0;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(2);

    delete state.awards.largestArmy;
    recomputeVictoryPoints(state, 0);
    expect(state.players[0]!.victoryPoints).toBe(0);
  });
});

describe("playKnight", () => {
  function withKnight(g: GameState): void {
    g.players[0]!.devCards.push({ type: "knight", boughtThisTurn: false, played: false });
  }

  it("after roll: enters movingRobber, records robberReturn=main, bumps count; moveRobber returns to main", () => {
    const g = mainGame(); // subPhase === "main"
    withKnight(g);
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.turn.robberReturn).toBe("main");
    expect(r.state.players[0]!.knightsPlayed).toBe(1);

    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.board.robber).toBe(hex);
    expect(moved.state.turn.subPhase).toBe("main");
  });

  it("before roll: enters movingRobber, records robberReturn=awaitingRoll; after moveRobber the player still rolls", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    withKnight(g);
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.turn.subPhase).toBe("movingRobber");
    expect(r.state.turn.robberReturn).toBe("awaitingRoll");
    expect(r.state.players[0]!.knightsPlayed).toBe(1);

    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.turn.subPhase).toBe("awaitingRoll");

    // a non-7 roll (dice [1,1] = 2) advances to main
    const rolled = apply(moved.state, { type: "rollDice" }, rngOf(0, 0));
    expectOk(rolled);
    expect(rolled.state.turn.subPhase).toBe("main");
  });

  it("cannot play a knight bought this turn", () => {
    const g = mainGame();
    g.players[0]!.devCards.push({ type: "knight", boughtThisTurn: true, played: false });
    const r = apply(g, { type: "playKnight" }, rngOf());
    expect(r.ok).toBe(false);
    expect(g.players[0]!.knightsPlayed).toBe(0);
  });

  it("only one dev card may be played per turn (knight then another dev card is rejected)", () => {
    const g = mainGame();
    withKnight(g);
    g.players[0]!.devCards.push({ type: "monopoly", boughtThisTurn: false, played: false });

    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    // resolve the robber so we're back in "main" (where monopoly is allowed by subPhase)
    const hex = emptyTargetHex(r.state);
    const moved = apply(r.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    expect(moved.state.turn.subPhase).toBe("main");

    // second dev card this turn is rejected by devCardPlayedThisTurn
    const second = apply(moved.state, { type: "playMonopoly", resource: "brick" }, rngOf());
    expect(second.ok).toBe(false);
  });

  it("third knight grants the Largest Army award (+2 VP)", () => {
    const g = mainGame();
    g.players[0]!.knightsPlayed = 2; // about to play the 3rd
    withKnight(g);
    const before = g.players[0]!.victoryPoints;
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.knightsPlayed).toBe(3);
    expect(r.state.awards.largestArmy).toBe(0);
    expect(r.state.players[0]!.victoryPoints).toBe(before + 2);
  });
});

describe("Largest Army transfer", () => {
  /** Give `seat` a playable knight card. */
  function knightFor(g: GameState, seat: number): void {
    g.players[seat]!.devCards.push({ type: "knight", boughtThisTurn: false, played: false });
  }
  /** Play a knight for the active seat, then move the robber to an empty hex
   * so the action resolves back to "main"/"awaitingRoll". Returns the post-move state. */
  function playKnightAndResolve(g: GameState): GameState {
    const played = apply(g, { type: "playKnight" }, rngOf());
    expectOk(played);
    const hex = emptyTargetHex(played.state);
    const moved = apply(played.state, { type: "moveRobber", hex }, rngOf());
    expectOk(moved);
    return moved.state;
  }

  it("(a) the third knight grants Largest Army and +2 VP to that seat", () => {
    const g = mainGame();
    g.players[0]!.knightsPlayed = 2; // about to play the 3rd
    knightFor(g, 0);
    const before = g.players[0]!.victoryPoints;

    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.knightsPlayed).toBe(3);
    expect(r.state.awards.largestArmy).toBe(0);
    expect(r.state.players[0]!.victoryPoints).toBe(before + 2);
  });

  it("(b) an opponent who strictly exceeds the holder steals the award (and the +2 moves)", () => {
    // Player 0 earns Largest Army by playing their 3rd knight.
    const g = mainGame();
    g.players[0]!.knightsPlayed = 2;
    knightFor(g, 0);
    const afterP0 = playKnightAndResolve(g);
    expect(afterP0.awards.largestArmy).toBe(0);
    expect(afterP0.players[0]!.victoryPoints).toBe(2); // 0 buildings + Largest Army

    // Player 1 is poised at 3 knights and plays a 4th -> 4 > 3 -> steals the award.
    afterP0.players[1]!.knightsPlayed = 3;
    knightFor(afterP0, 1);
    afterP0.turn = { activeSeat: 1, subPhase: "main" };

    const r = apply(afterP0, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.players[1]!.knightsPlayed).toBe(4);
    expect(r.state.awards.largestArmy).toBe(1);
    expect(r.state.players[1]!.victoryPoints).toBe(2); // new holder gains +2
    expect(r.state.players[0]!.victoryPoints).toBe(0); // old holder loses the +2
  });

  it("(c) a tie does NOT steal the award (must strictly exceed)", () => {
    // Player 0 holds Largest Army at 3 knights.
    const g = mainGame();
    g.players[0]!.knightsPlayed = 2;
    knightFor(g, 0);
    const afterP0 = playKnightAndResolve(g);
    expect(afterP0.awards.largestArmy).toBe(0);

    // Player 1 plays their 3rd knight -> ties at 3, does not exceed.
    afterP0.players[1]!.knightsPlayed = 2;
    knightFor(afterP0, 1);
    afterP0.turn = { activeSeat: 1, subPhase: "main" };
    const beforeP1 = afterP0.players[1]!.victoryPoints;

    const r = apply(afterP0, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.players[1]!.knightsPlayed).toBe(3);
    expect(r.state.awards.largestArmy).toBe(0); // unchanged
    expect(r.state.players[1]!.victoryPoints).toBe(beforeP1); // no +2 for the tie
  });

  it("(d) reaching 10 VP via Largest Army ends the game", () => {
    const g = mainGame();
    // 8 VP of buildings (4 cities), so the +2 from Largest Army reaches exactly 10.
    const verts = topology().vertexIds.slice(0, 4);
    verts.forEach((v) => (g.board.buildings[v] = { owner: 0, type: "city" }));
    recomputeVictoryPoints(g, 0);
    expect(g.players[0]!.victoryPoints).toBe(8);

    g.players[0]!.knightsPlayed = 2; // about to play the 3rd
    knightFor(g, 0);

    // checkVictory runs at the end of the playKnight action itself.
    const r = apply(g, { type: "playKnight" }, rngOf());
    expectOk(r);
    expect(r.state.awards.largestArmy).toBe(0);
    expect(r.state.players[0]!.victoryPoints).toBe(10);
    expect(r.state.phase).toBe("finished");
    expect(r.state.winner).toBe(0);
  });
});

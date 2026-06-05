import { describe, it, expect } from "vitest";
import { createBoard } from "../../src/board";
import { createInitialGame } from "../../src/engine/state";
import { apply } from "../../src/engine/apply";
import { topology } from "../../src/engine/board";
import type { GameState } from "../../src/engine/types";
import type { ResourceMap } from "../../src/engine/resources";
import type { Rng } from "../../src/engine/rng";

function rm(wood = 0, brick = 0, sheep = 0, wheat = 0, ore = 0): ResourceMap {
  return { wood, brick, sheep, wheat, ore };
}

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

describe("bank/port trading", () => {
  it("4:1 default trade (no port access)", () => {
    const g = mainGame();
    // Clear all buildings so player 0 owns no port vertex
    g.board.buildings = {};
    // Clear ports to be explicit about no port access
    g.board.ports = [];
    g.players[0]!.resources.wood = 4;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 4);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("3:1 generic port reduces trade ratio to 3", () => {
    const g = mainGame();
    // Pick two vertex IDs for the port
    const [v, v2] = topology().vertexIds;
    // Set up a controlled "any" port deterministically
    g.board.ports = [{ edge: "x", vertices: [v!, v2!], kind: "any" }];
    // Player 0 has a settlement on the port vertex
    g.board.buildings = {};
    g.board.buildings[v!] = { owner: 0, type: "settlement" };
    g.players[0]!.resources.wood = 3;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 3);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("2:1 matching port reduces trade ratio to 2", () => {
    const g = mainGame();
    // Pick two vertex IDs for the port
    const [v, v2] = topology().vertexIds;
    // Set up a controlled 2:1 wood port deterministically
    g.board.ports = [{ edge: "x", vertices: [v!, v2!], kind: "wood" }];
    g.board.buildings = {};
    g.board.buildings[v!] = { owner: 0, type: "settlement" };
    g.players[0]!.resources.wood = 2;
    const bankWoodBefore = g.bank.wood;
    const bankBrickBefore = g.bank.brick;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expectOk(r);
    expect(r.state.players[0]!.resources.wood).toBe(0);
    expect(r.state.players[0]!.resources.brick).toBe(1);
    expect(r.state.bank.wood).toBe(bankWoodBefore + 2);
    expect(r.state.bank.brick).toBe(bankBrickBefore - 1);
  });

  it("rejects when player has fewer resources than the required ratio", () => {
    const g = mainGame();
    g.board.buildings = {};
    g.board.ports = [];
    g.players[0]!.resources.wood = 3; // 4:1 required, only 3 available

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when bank has none of the requested resource", () => {
    const g = mainGame();
    g.board.buildings = {};
    g.board.ports = [];
    g.players[0]!.resources.wood = 4;
    g.bank.brick = 0;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects trading a resource for itself", () => {
    const g = mainGame();
    g.players[0]!.resources.wood = 4;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "wood" }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when not in main subPhase (awaiting roll)", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    g.players[0]!.resources.wood = 4;

    const r = apply(g, { type: "tradeBank", give: "wood", get: "brick" }, rngOf());
    expect(r.ok).toBe(false);
  });
});

describe("propose trade offer", () => {
  it("open offer appears in tradeOffers with correct fields and id 0", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(2, 0, 0, 0, 0); // give 2 wood
    const r = apply(g, { type: "proposeTrade", give: rm(2), want: rm(0, 1) }, rngOf());
    expectOk(r);
    expect(r.state.tradeOffers).toHaveLength(1);
    const offer = r.state.tradeOffers[0]!;
    expect(offer.id).toBe(0);
    expect(offer.from).toBe(0);
    expect(offer.to).toBeUndefined();
    expect(offer.give).toEqual(rm(2));
    expect(offer.want).toEqual(rm(0, 1));
    expect(r.state.tradeSeq).toBe(1);
  });

  it("targeted offer includes 'to' field and id increments across two offers", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(3, 2, 0, 0, 0);

    // First offer (open)
    const r1 = apply(g, { type: "proposeTrade", give: rm(1), want: rm(0, 1) }, rngOf());
    expectOk(r1);
    expect(r1.state.tradeOffers[0]!.id).toBe(0);
    expect(r1.state.tradeSeq).toBe(1);

    // Second offer (targeted at seat 2) using the updated state
    r1.state.players[0]!.resources = rm(3, 2, 0, 0, 0);
    const r2 = apply(r1.state, { type: "proposeTrade", give: rm(0, 1), want: rm(0, 0, 1), to: 2 }, rngOf());
    expectOk(r2);
    expect(r2.state.tradeOffers).toHaveLength(2);
    const offer2 = r2.state.tradeOffers[1]!;
    expect(offer2.id).toBe(1);
    expect(offer2.from).toBe(0);
    expect(offer2.to).toBe(2);
    expect(r2.state.tradeSeq).toBe(2);
  });

  it("rejects when player lacks the offered resources", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(1, 0, 0, 0, 0); // only 1 wood, trying to give 2
    const r = apply(g, { type: "proposeTrade", give: rm(2), want: rm(0, 1) }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when give is all-zero", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(0, 2, 0, 0, 0);
    const r = apply(g, { type: "proposeTrade", give: rm(0), want: rm(0, 1) }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when want is all-zero", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(2, 0, 0, 0, 0);
    const r = apply(g, { type: "proposeTrade", give: rm(2), want: rm(0) }, rngOf());
    expect(r.ok).toBe(false);
  });

  it("rejects when not in main subPhase", () => {
    const g = mainGame();
    g.turn.subPhase = "awaitingRoll";
    g.players[0]!.resources = rm(2, 0, 0, 0, 0);
    const r = apply(g, { type: "proposeTrade", give: rm(2), want: rm(0, 1) }, rngOf());
    expect(r.ok).toBe(false);
  });
});

describe("accept trade offer", () => {
  it("valid accept swaps resources both ways and removes the offer", () => {
    // Player 0 proposes: give 1 wheat, want 1 ore
    const g = mainGame();
    g.players[0]!.resources = rm(0, 0, 0, 1, 0); // 1 wheat
    g.players[1]!.resources = rm(0, 0, 0, 0, 1); // 1 ore

    const r1 = apply(g, { type: "proposeTrade", give: rm(0, 0, 0, 1), want: rm(0, 0, 0, 0, 1) }, rngOf());
    expectOk(r1);
    expect(r1.state.tradeOffers).toHaveLength(1);
    expect(r1.state.tradeOffers[0]!.id).toBe(0);

    // Player 1 accepts
    const r2 = apply(r1.state, { type: "acceptTrade", offerId: 0, seat: 1 }, rngOf());
    expectOk(r2);

    // Proposer (0): lost 1 wheat, gained 1 ore
    expect(r2.state.players[0]!.resources.wheat).toBe(0);
    expect(r2.state.players[0]!.resources.ore).toBe(1);

    // Acceptor (1): lost 1 ore, gained 1 wheat
    expect(r2.state.players[1]!.resources.ore).toBe(0);
    expect(r2.state.players[1]!.resources.wheat).toBe(1);

    // Offer is consumed
    expect(r2.state.tradeOffers).toHaveLength(0);
  });

  it("rejects if the proposer can no longer cover the give (offer stays)", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(0, 0, 0, 1, 0); // 1 wheat to offer
    g.players[1]!.resources = rm(0, 0, 0, 0, 1); // 1 ore

    const r1 = apply(g, { type: "proposeTrade", give: rm(0, 0, 0, 1), want: rm(0, 0, 0, 0, 1) }, rngOf());
    expectOk(r1);

    // Drain the proposer's wheat so they can no longer cover it
    r1.state.players[0]!.resources.wheat = 0;

    const r2 = apply(r1.state, { type: "acceptTrade", offerId: 0, seat: 1 }, rngOf());
    expect(r2.ok).toBe(false);
    // Offer should still be present
    expect(r1.state.tradeOffers).toHaveLength(1);
  });

  it("rejects a targeted offer accepted by the wrong seat", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(0, 0, 0, 1, 0); // 1 wheat
    g.players[2]!.resources = rm(0, 0, 0, 0, 1); // 1 ore (seat 2 has resource, but offer is for seat 1)

    // Target offer to seat 1 only
    const r1 = apply(g, { type: "proposeTrade", give: rm(0, 0, 0, 1), want: rm(0, 0, 0, 0, 1), to: 1 }, rngOf());
    expectOk(r1);

    // Seat 2 tries to accept a targeted offer addressed to seat 1
    const r2 = apply(r1.state, { type: "acceptTrade", offerId: 0, seat: 2 }, rngOf());
    expect(r2.ok).toBe(false);
  });

  it("rejects accepting your own offer", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(0, 0, 0, 1, 0); // 1 wheat

    const r1 = apply(g, { type: "proposeTrade", give: rm(0, 0, 0, 1), want: rm(0, 0, 0, 0, 1) }, rngOf());
    expectOk(r1);

    // Proposer (seat 0) tries to accept their own offer
    const r2 = apply(r1.state, { type: "acceptTrade", offerId: 0, seat: 0 }, rngOf());
    expect(r2.ok).toBe(false);
  });
});

describe("cancel trade + endTurn clearing", () => {
  it("proposer can cancel their own offer", () => {
    const g = mainGame();
    g.players[0]!.resources = rm(2, 0, 0, 0, 0);

    // Player 0 proposes an offer (id will be 0)
    const r1 = apply(g, { type: "proposeTrade", give: rm(2), want: rm(0, 1) }, rngOf());
    expectOk(r1);
    expect(r1.state.tradeOffers).toHaveLength(1);
    expect(r1.state.tradeOffers[0]!.id).toBe(0);

    // Player 0 (active seat) cancels their own offer
    const r2 = apply(r1.state, { type: "cancelTrade", offerId: 0 }, rngOf());
    expectOk(r2);
    expect(r2.state.tradeOffers).toHaveLength(0);
  });

  it("non-proposer cannot cancel an offer they do not own", () => {
    const g = mainGame();
    // Seed an offer with from: 1, but active seat is 0
    g.tradeOffers = [{ id: 0, from: 1, give: rm(1), want: rm(0, 1) }];

    const r = apply(g, { type: "cancelTrade", offerId: 0 }, rngOf());
    expect(r.ok).toBe(false);
    // Offer still present on the original game state (apply does structuredClone internally)
    expect(g.tradeOffers).toHaveLength(1);
  });

  it("endTurn clears all trade offers and advances the turn normally", () => {
    const g = mainGame();
    // Seed two trade offers (any from/ids)
    g.tradeOffers = [
      { id: 0, from: 0, give: rm(1), want: rm(0, 1) },
      { id: 1, from: 0, give: rm(0, 0, 1), want: rm(0, 0, 0, 1) },
    ];
    // Active seat 0, subPhase "main" — endTurn should succeed
    const r = apply(g, { type: "endTurn" }, rngOf());
    expectOk(r);
    expect(r.state.tradeOffers).toHaveLength(0);
    expect(r.state.turn.activeSeat).toBe(1);
    expect(r.state.turn.subPhase).toBe("awaitingRoll");
  });
});

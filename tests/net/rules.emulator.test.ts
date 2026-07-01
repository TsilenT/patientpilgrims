import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, update } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

const meta = (over: object = {}) =>
  ({ createdAt: 1, host: "host", status: "active", mode: "beginner", ...over });

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.database();
    await set(ref(db, "games/g/meta"), meta());
    await set(ref(db, "games/g/_claims/0"), "tokenZero");
    await set(ref(db, "games/g/state"), { version: 0, turn: { activeSeat: 0 } });
  });
}

describe("meta rules", () => {
  it("creates only with host = self, and any authenticated player updates game settings without changing host", async () => {
    const h = env.authenticatedContext("h").database();
    await assertSucceeds(set(ref(h, "games/m1/meta"), meta({ host: "h", status: "lobby" })));
    await assertFails(set(ref(h, "games/m2/meta"), meta({ host: "someone-else", status: "lobby" })));
    await assertSucceeds(set(ref(h, "games/m1/meta/mode"), "random"));
    await assertFails(set(ref(h, "games/m1/meta/host"), "takeover"));
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/m1/meta/mode"), "beginner"));
    await assertFails(set(ref(eve, "games/m1/meta/host"), "takeover"));
  });
});

describe("lobby rules", () => {
  async function lobbyGame(id: string) {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), `games/${id}/meta`), meta({ status: "lobby" }));
    });
  }

  it("claims an empty slot with own uid; stealing and impersonation are denied", async () => {
    await lobbyGame("l1");
    const alice = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(alice, "games/l1/lobby/0"), { uid: "alice", name: "Alice", color: "red" }));
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "games/l1/lobby/0"), { uid: "bob", name: "Bob", color: "blue" }));
    await assertFails(set(ref(bob, "games/l1/lobby/1"), { uid: "alice", name: "Fake", color: "blue" }));
  });

  it("lets a player edit their own seat", async () => {
    await lobbyGame("l2");
    const alice = env.authenticatedContext("alice").database();
    await set(ref(alice, "games/l2/lobby/0"), { uid: "alice", name: "Alice", color: "red" });
    await assertSucceeds(set(ref(alice, "games/l2/lobby/0"), { uid: "alice", name: "Queen Alice", color: "blue" }));
  });

  it("any authenticated lobby player can clear a seat", async () => {
    await lobbyGame("l3");
    const alice = env.authenticatedContext("alice").database();
    await set(ref(alice, "games/l3/lobby/0"), { uid: "alice", name: "Alice", color: "red" });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/l3/lobby/0"), null));
  });

  it("rejects malformed seats and claims after the game started", async () => {
    await lobbyGame("l4");
    const alice = env.authenticatedContext("alice").database();
    await assertFails(set(ref(alice, "games/l4/lobby/0"), { uid: "alice", name: "Alice" })); // no color
    await assertFails(set(ref(alice, "games/l4/lobby/1"), { uid: "alice", name: "", color: "red" }));
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/l4/meta/status"), "active");
    });
    await assertFails(set(ref(alice, "games/l4/lobby/2"), { uid: "alice", name: "Alice", color: "red" }));
  });
});

describe("start + rescue rules", () => {
  it("lets authenticated players read claim tokens for recovery links", async () => {
    await seed();
    const db = env.authenticatedContext("eve").database();
    const snap = await assertSucceeds(get(ref(db, "games/g/_claims/0")));
    expect(snap.val()).toBe("tokenZero");
  });

  it("any authenticated player mints tokens and seats once", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/s1/meta"), meta({ status: "lobby" }));
    });
    const host = env.authenticatedContext("host").database();
    await assertSucceeds(set(ref(host, "games/s1/_claims/0"), "t0"));
    await assertFails(set(ref(host, "games/s1/_claims/0"), "t0-again")); // write-once
    await assertSucceeds(set(ref(host, "games/s1/seats/0"), { uid: "alice" }));
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/s1/_claims/1"), "t1"));
    await assertSucceeds(set(ref(eve, "games/s1/seats/1"), { uid: "eve-friend" }));
  });

  it("any authenticated player starts with one atomic multi-path update", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/s2/meta"), meta({ status: "lobby" }));
    });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(update(ref(eve, "games/s2"), {
      state: { version: 0, turn: { activeSeat: 0 } },
      "meta/status": "active",
      "seats/0": { uid: "alice" },
      "seats/1": { uid: "bob" },
      "seats/2": { uid: "carol" },
      "_claims/0": "t0", "_claims/1": "t1", "_claims/2": "t2",
    }));
    const snap = await get(ref(env.authenticatedContext("alice").database(), "games/s2/meta"));
    expect(snap.val().status).toBe("active");
  });

  it("rebinds a seat to a new device with the proof token (rescue link)", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/0"), { uid: "old-device" });
    });
    const fresh = env.authenticatedContext("new-device").database();
    await assertSucceeds(set(ref(fresh, "games/g/seats/0"), { uid: "new-device", proof: "tokenZero" }));
    const thief = env.authenticatedContext("thief").database();
    await assertFails(set(ref(thief, "games/g/seats/0"), { uid: "thief", proof: "wrong" }));
  });
});

describe("pre-lobby games (old schema, no host/status in meta)", () => {
  it("keeps playing and rescue-rebinding under the new rules", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      // exactly what createGame wrote before the lobby existed
      await set(ref(db, "games/old/meta"), { createdAt: 1, playerCount: 3, names: ["A", "B", "C"], seatColors: ["red", "blue", "white"] });
      await set(ref(db, "games/old/_claims/0"), "tok0");
      await set(ref(db, "games/old/seats/0"), { uid: "alice" });
      await set(ref(db, "games/old/state"), { version: 7, turn: { activeSeat: 0 } });
    });
    // the active player still advances the game
    const alice = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(alice, "games/old/state"), { version: 8, turn: { activeSeat: 0 } }));
    // an old claim link still rebinds the seat to a new device
    const fresh = env.authenticatedContext("alice-new-phone").database();
    await assertSucceeds(set(ref(fresh, "games/old/seats/0"), { uid: "alice-new-phone", proof: "tok0" }));
    // and the meta read used for routing still works
    await assertSucceeds(get(ref(alice, "games/old/meta")));
  });
});

describe("state rules", () => {
  it("any authenticated player creates the initial state", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/st1/meta"), meta({ status: "lobby" }));
    });
    const eve = env.authenticatedContext("eve").database();
    await assertSucceeds(set(ref(eve, "games/st1/state"), { version: 0, turn: { activeSeat: 0 } }));
  });

  it("lets the active seat advance version by exactly 1", async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/0"), { uid: "alice" });
    });
    const db = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(db, "games/g/state"), { version: 1, turn: { activeSeat: 0 } }));
    await assertFails(set(ref(db, "games/g/state"), { version: 99, turn: { activeSeat: 0 } }));
  });

  it("lets a non-active seat advance the client-authoritative state by exactly 1", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/na/meta"), meta());
      await set(ref(db, "games/na/seats/0"), { uid: "alice" });
      await set(ref(db, "games/na/seats/1"), { uid: "bob" });
      await set(ref(db, "games/na/state"), { version: 0, turn: { activeSeat: 0 } });
    });
    const bob = env.authenticatedContext("bob").database();
    await assertSucceeds(set(ref(bob, "games/na/state"), { version: 1, turn: { activeSeat: 0 } }));
    await assertFails(set(ref(bob, "games/na/state"), { version: 99, turn: { activeSeat: 0 } }));
  });

  it("lets a non-active seat create the first player trade offer", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/trade/meta"), meta());
      await set(ref(db, "games/trade/seats/0"), { uid: "alice" });
      await set(ref(db, "games/trade/seats/1"), { uid: "bob" });
      await set(ref(db, "games/trade/state"), {
        version: 0, turn: { activeSeat: 0 }, tradeSeq: 0, tradeOffers: [],
      });
    });
    const bob = env.authenticatedContext("bob").database();
    await assertSucceeds(set(ref(bob, "games/trade/state"), {
      version: 1,
      turn: { activeSeat: 0 },
      tradeSeq: 1,
      tradeOffers: [{ id: 0, from: 1, give: { wood: 1 }, want: { wheat: 1 } }],
    }));
  });
});

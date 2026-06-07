import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

async function seed() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.database();
    await set(ref(db, "games/g/_claims/0"), "tokenZero");
    await set(ref(db, "games/g/state"), { version: 0, turn: { activeSeat: 0 } });
  });
}

describe("rtdb security rules (emulator)", () => {
  beforeAll(seed);

  it("denies reading another seat's claim token", async () => {
    const db = env.authenticatedContext("eve").database();
    await assertFails(get(ref(db, "games/g/_claims/0")));
  });

  it("binds a seat when the proof token matches", async () => {
    const db = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(db, "games/g/seats/0"), { uid: "alice", proof: "tokenZero" }));
  });

  it("rejects a seat bind with a wrong token", async () => {
    const db = env.authenticatedContext("mallory").database();
    await assertFails(set(ref(db, "games/g/seats/1"), { uid: "mallory", proof: "wrong" }));
  });

  it("lets the active seat advance version by exactly 1", async () => {
    const db = env.authenticatedContext("alice").database(); // alice owns seat 0 (active)
    await assertSucceeds(set(ref(db, "games/g/state"), { version: 1, turn: { activeSeat: 0 } }));
  });

  it("rejects a write from a non-active seat", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await set(ref(c.database(), "games/g/seats/1"), { uid: "bob" });
    });
    const db = env.authenticatedContext("bob").database(); // seat 1, not active
    await assertFails(set(ref(db, "games/g/state"), { version: 2, turn: { activeSeat: 0 } }));
  });

  it("rejects a version skip", async () => {
    const db = env.authenticatedContext("alice").database();
    await assertFails(set(ref(db, "games/g/state"), { version: 99, turn: { activeSeat: 0 } }));
  });

  it("lets the creator write ALL seat claim tokens (createGame writes them one by one)", async () => {
    const db = env.authenticatedContext("creator").database();
    await assertSucceeds(set(ref(db, "games/multi/_claims/0"), "t0"));
    await assertSucceeds(set(ref(db, "games/multi/_claims/1"), "t1")); // regression: must not be denied
    await assertSucceeds(set(ref(db, "games/multi/_claims/2"), "t2"));
  });

  it("rejects overwriting an existing claim token (write-once)", async () => {
    const db = env.authenticatedContext("x").database();
    await assertSucceeds(set(ref(db, "games/wo/_claims/0"), "first"));
    await assertFails(set(ref(db, "games/wo/_claims/0"), "second"));
  });

  it("lets a non-active seat write while a trade offer is open (async accept)", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/trade/seats/0"), { uid: "alice" });
      await set(ref(db, "games/trade/seats/1"), { uid: "bob" });
      await set(ref(db, "games/trade/state"), {
        version: 0, turn: { activeSeat: 0 },
        tradeOffers: [{ id: 0, from: 0, give: { wood: 1 }, want: { wheat: 1 } }],
      });
    });
    const db = env.authenticatedContext("bob").database(); // seat 1, NOT active
    // bob accepts → writes version+1; allowed only because an offer is open
    await assertSucceeds(set(ref(db, "games/trade/state"), {
      version: 1, turn: { activeSeat: 0 }, tradeOffers: [],
    }));
  });

  it("still rejects a non-active write when no trade offer is open", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.database();
      await set(ref(db, "games/notrade/seats/0"), { uid: "alice" });
      await set(ref(db, "games/notrade/seats/1"), { uid: "bob" });
      await set(ref(db, "games/notrade/state"), { version: 0, turn: { activeSeat: 0 } });
    });
    const db = env.authenticatedContext("bob").database();
    await assertFails(set(ref(db, "games/notrade/state"), { version: 1, turn: { activeSeat: 0 } }));
  });
});

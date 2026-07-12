import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, runTransaction } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "patient-pilgrims-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

describe("rtdb game lifecycle (emulator)", () => {
  it("writes and reads back a state blob under a transaction", async () => {
    const ctx = env.authenticatedContext("uid-a");
    const db = ctx.database();
    // uid-a hosts the game: creates meta, mints a token, seats itself, writes state.
    await set(ref(db, "games/g1/meta"), { createdAt: 1, host: "uid-a", status: "lobby", mode: "beginner" });
    await set(ref(db, "games/g1/_claims/0"), "tok0");
    await set(ref(db, "games/g1/seats/0"), { uid: "uid-a", proof: "tok0" });
    await set(ref(db, "games/g1/state"), { version: 0, turn: { activeSeat: 0 } });
    const tx = await runTransaction(ref(db, "games/g1/state"), (s: { version: number } | null) =>
      s ? { ...s, version: s.version + 1 } : s,
    );
    expect(tx.committed).toBe(true);
    const snap = await get(ref(db, "games/g1/state"));
    expect(snap.val().version).toBe(1);
  });
});

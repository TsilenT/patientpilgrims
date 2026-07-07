import { describe, it, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, set, get, remove } from "firebase/database";
import { readFileSync } from "node:fs";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "adulting-catan-test",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});
afterAll(async () => { await env.cleanup(); });

const sub = { subscription: { endpoint: "https://example.com/x", keys: { p256dh: "a", auth: "b" } }, updatedAt: 1 };

describe("pushSubs rules", () => {
  it("lets a user write, read, and remove only their own subscription", async () => {
    const alice = env.authenticatedContext("alice").database();
    await assertSucceeds(set(ref(alice, "pushSubs/alice"), sub));
    await assertSucceeds(get(ref(alice, "pushSubs/alice")));
    await assertSucceeds(remove(ref(alice, "pushSubs/alice")));
  });

  it("denies writing or reading another user's subscription", async () => {
    const bob = env.authenticatedContext("bob").database();
    await assertFails(set(ref(bob, "pushSubs/alice"), sub));
    await assertFails(get(ref(bob, "pushSubs/alice")));
  });

  it("denies unauthenticated access", async () => {
    const anon = env.unauthenticatedContext().database();
    await assertFails(set(ref(anon, "pushSubs/alice"), sub));
    await assertFails(get(ref(anon, "pushSubs/alice")));
  });
});

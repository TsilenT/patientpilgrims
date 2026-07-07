import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNotification } from "./recipients.mjs";

const seats = { 0: { uid: "alice" }, 1: { uid: "bob" } };
const subs = { bob: { subscription: { endpoint: "https://x/bob" } } };

test("returns a send for the new active seat's subscribed player", () => {
  const out = nextNotification({ gameId: "g1", gameName: "Game", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.equal(out.uid, "bob");
  assert.equal(out.subscription.endpoint, "https://x/bob");
  assert.match(out.payload.body, /your turn/i);
  assert.equal(out.payload.url, "#/g/g1");
});

test("dedups when the active seat is unchanged", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 1, seats, subs }), null);
});

test("returns null when the seat has no uid", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 5, lastNotifiedSeat: 0, seats, subs }), null);
});

test("returns null when the player has no subscription", () => {
  assert.equal(nextNotification({ gameId: "g1", activeSeat: 0, lastNotifiedSeat: 1, seats, subs }), null);
});

test("falls back to the app name when gameName is missing", () => {
  const out = nextNotification({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.match(out.payload.body, /Patient Pilgrims/);
});

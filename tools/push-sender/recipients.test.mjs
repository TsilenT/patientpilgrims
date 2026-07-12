import { test } from "node:test";
import assert from "node:assert/strict";
import { nextNotifications } from "./recipients.mjs";

const seats = { 0: { uid: "alice" }, 1: { uid: "bob" } };
const subs = { bob: { subscription: { endpoint: "https://x/bob" } } };

test("returns a send for the new active seat's subscribed player", () => {
  const [out] = nextNotifications({ gameId: "g1", gameName: "Game", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.equal(out.uid, "bob");
  assert.equal(out.subscription.endpoint, "https://x/bob");
  assert.match(out.payload.body, /your turn/i);
  assert.equal(out.payload.url, "#/g/g1");
});

test("dedups when the active seat is unchanged", () => {
  assert.deepEqual(nextNotifications({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 1, seats, subs }), []);
});

test("stays quiet once the game is finished", () => {
  assert.deepEqual(
    nextNotifications({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 0, phase: "finished", seats, subs }),
    [],
  );
});

test("returns null when the seat has no uid", () => {
  assert.deepEqual(nextNotifications({ gameId: "g1", activeSeat: 5, lastNotifiedSeat: 0, seats, subs }), []);
});

test("returns null when the player has no subscription", () => {
  assert.deepEqual(nextNotifications({ gameId: "g1", activeSeat: 0, lastNotifiedSeat: 1, seats, subs }), []);
});

test("falls back to the app name when gameName is missing", () => {
  const [out] = nextNotifications({ gameId: "g1", activeSeat: 1, lastNotifiedSeat: 0, seats, subs });
  assert.match(out.payload.body, /Patient Pilgrims/);
});

test("returns sends for every subscribed device controlling the seat", () => {
  const multiDeviceSeats = {
    1: { uid: "bob", devices: { "bob-tablet": "token", "bob-old-phone": "token" } },
  };
  const multiDeviceSubs = {
    bob: { subscription: { endpoint: "https://x/bob" } },
    "bob-tablet": { subscription: { endpoint: "https://x/tablet" } },
  };
  const out = nextNotifications({
    gameId: "g1", activeSeat: 1, lastNotifiedSeat: 0,
    seats: multiDeviceSeats, subs: multiDeviceSubs,
  });
  assert.deepEqual(out.map((send) => send.uid), ["bob", "bob-tablet"]);
});

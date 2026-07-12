import "dotenv/config";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import webpush from "web-push";
import { nextNotifications } from "./recipients.mjs";

const serviceAccount = JSON.parse(readFileSync(process.env.SERVICE_ACCOUNT_PATH, "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const db = admin.database();
const lastNotified = new Map(); // gameId -> last seen activeSeat

db.ref("games").on("child_added", (snap) => watchGame(snap.key));
db.ref("games").on("child_removed", (snap) => lastNotified.delete(snap.key));

function watchGame(gameId) {
  db.ref(`games/${gameId}/state/turn/activeSeat`).on("value", async (snap) => {
    const activeSeat = snap.val();
    const last = lastNotified.get(gameId);
    lastNotified.set(gameId, activeSeat);
    // First observation only seeds state — don't notify for a turn already in progress.
    if (last === undefined || activeSeat === last) return;
    await maybeSend(gameId, activeSeat, last);
  });
}

async function maybeSend(gameId, activeSeat, lastSeat) {
  const [seatsSnap, metaSnap, phaseSnap] = await Promise.all([
    db.ref(`games/${gameId}/seats`).get(),
    db.ref(`games/${gameId}/meta`).get(),
    db.ref(`games/${gameId}/state/phase`).get(),
  ]);
  const seats = seatsSnap.val() || {};
  const seat = seats?.[activeSeat];
  if (!seat?.uid) return;
  const uids = [...new Set([seat.uid, ...Object.keys(seat.devices || {})])];
  const subEntries = await Promise.all(uids.map(async (uid) => [
    uid,
    (await db.ref(`pushSubs/${uid}`).get()).val(),
  ]));
  const sends = nextNotifications({
    gameId,
    gameName: metaSnap.val()?.name,
    activeSeat,
    lastNotifiedSeat: lastSeat,
    phase: phaseSnap.val(),
    seats,
    subs: Object.fromEntries(subEntries),
  });
  for (const send of sends) {
    try {
      await webpush.sendNotification(send.subscription, JSON.stringify(send.payload));
      console.log(`sent turn ping → game ${gameId}, seat ${activeSeat}, device ${send.uid}`);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.ref(`pushSubs/${send.uid}`).remove();
        console.log(`removed expired subscription for ${send.uid}`);
      } else {
        console.error(`send failed (${err.statusCode})`, err.body || err.message);
      }
    }
  }
}

console.log("push-sender running — watching for turn changes");

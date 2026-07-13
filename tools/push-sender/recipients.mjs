/**
 * Pure resolver: given a turn change, decide which devices (if any) to notify.
 * @returns {{ uid: string, subscription: object, payload: object }[]}
 */
export function nextNotifications({ gameId, gameName, activeSeat, lastNotifiedSeat, phase, seats, subs }) {
  if (phase === "finished") return [];
  if (activeSeat === null || activeSeat === undefined) return [];
  if (activeSeat === lastNotifiedSeat) return [];
  const seat = seats?.[activeSeat];
  if (!seat?.uid) return [];
  const uids = [...new Set([seat.uid, ...Object.keys(seat.devices || {})])];
  return uids.flatMap((uid) => {
    const entry = subs?.[uid];
    if (!entry?.subscription) return [];
    return [{
      uid,
      subscription: entry.subscription,
      payload: {
        title: "Your turn",
        body: `It's your turn in ${gameName || "Patient Pilgrims"}.`,
        // Explicitly include the app-directory segment. Hash-only targets can
        // otherwise be resolved against sw.js by notification openWindow().
        url: `./#/g/${gameId}`,
      },
    }];
  });
}

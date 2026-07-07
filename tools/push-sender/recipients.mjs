/**
 * Pure resolver: given a turn change, decide who (if anyone) to notify.
 * @returns {{ uid: string, subscription: object, payload: object } | null}
 */
export function nextNotification({ gameId, gameName, activeSeat, lastNotifiedSeat, seats, subs }) {
  if (activeSeat === null || activeSeat === undefined) return null;
  if (activeSeat === lastNotifiedSeat) return null;
  const uid = seats?.[activeSeat]?.uid;
  if (!uid) return null;
  const entry = subs?.[uid];
  if (!entry?.subscription) return null;
  return {
    uid,
    subscription: entry.subscription,
    payload: {
      title: "Your turn",
      body: `It's your turn in ${gameName || "Patient Pilgrims"}.`,
      url: `#/g/${gameId}`,
    },
  };
}

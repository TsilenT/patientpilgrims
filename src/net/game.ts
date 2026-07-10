import { ref, get, set, onValue, runTransaction } from "firebase/database";
import type { GameState } from "../engine/types";
import { database, ensureSignedIn } from "./firebase";
import { normalizeState } from "./normalize";
import type { RtdbBackend, CommitResult } from "./types";

interface SeatOwners {
  uid?: string;
  devices?: Record<string, string>;
}

/** Finds a seat owned by either its original browser or an additional claimed device. */
export function seatForUidInSeats(seats: Record<string, SeatOwners>, uid: string): number {
  for (const [k, seat] of Object.entries(seats)) {
    if (seat?.uid === uid || seat?.devices?.[uid] !== undefined) return Number(k);
  }
  return -1;
}

export function seatClaimConflict(currentSeat: number, requestedSeat: number): string | null {
  if (currentSeat === -1 || currentSeat === requestedSeat) return null;
  return `This browser already controls seat ${currentSeat + 1}. Open the link on the other device instead.`;
}

/** Adds this browser to a seat if the token matches. Existing devices remain connected. */
export async function claimSeat(id: string, seat: number, token: string): Promise<number> {
  const uid = await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/seats`));
  const seats = (snap.val() as Record<string, SeatOwners> | null) ?? {};
  const conflict = seatClaimConflict(seatForUidInSeats(seats, uid), seat);
  if (conflict !== null) throw new Error(conflict);
  await set(ref(database(), `games/${id}/seats/${seat}/devices/${uid}`), token);
  return seat;
}

/** Reads which seat (if any) the current uid owns in a game. -1 if none. */
export async function seatForUid(id: string): Promise<number> {
  const uid = await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/seats`));
  const seats = (snap.val() as Record<string, SeatOwners> | null) ?? {};
  return seatForUidInSeats(seats, uid);
}

/** A Firebase-backed RtdbBackend for the NetworkedGameStore. */
export function makeRtdbBackend(id: string): RtdbBackend {
  const stateRef = ref(database(), `games/${id}/state`);
  return {
    subscribe(cb) {
      // RTDB drops empty collections; rehydrate before the store/engine see the state.
      return onValue(stateRef, (snap) => cb(normalizeState(snap.val() as GameState | null)));
    },
    async commit(update): Promise<CommitResult> {
      let abortError: string | null = null;
      const tx = await runTransaction(stateRef, (current: GameState | null) => {
        const next = update(normalizeState(current));
        if (typeof next === "string") { abortError = next; return undefined; } // abort
        return next;
      });
      if (abortError !== null) return { ok: false, error: abortError };
      if (!tx.committed) return { ok: false, error: "The board changed — please retry." };
      return { ok: true, state: normalizeState(tx.snapshot.val() as GameState)! };
    },
  };
}

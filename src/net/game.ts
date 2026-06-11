import { ref, get, set, onValue, runTransaction } from "firebase/database";
import type { GameState } from "../engine/types";
import { database, ensureSignedIn } from "./firebase";
import { normalizeState } from "./normalize";
import type { RtdbBackend, CommitResult } from "./types";

/** Binds this browser's uid to a seat if the token matches. Returns the seat index. */
export async function claimSeat(id: string, seat: number, token: string): Promise<number> {
  const uid = await ensureSignedIn();
  // proof is written to a read:false subpath; the rule validates it against _claims/{seat}
  await set(ref(database(), `games/${id}/seats/${seat}`), { uid, proof: token });
  return seat;
}

/** Reads which seat (if any) the current uid owns in a game. -1 if none. */
export async function seatForUid(id: string): Promise<number> {
  const uid = await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/seats`));
  const seats = (snap.val() as Record<string, { uid?: string }> | null) ?? {};
  for (const [k, v] of Object.entries(seats)) if (v?.uid === uid) return Number(k);
  return -1;
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

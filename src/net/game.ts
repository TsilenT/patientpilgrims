import { ref, get, set, onValue, runTransaction } from "firebase/database";
import type { GameState } from "../engine/types";
import { createInitialGame, mulberry32, cryptoRng, type NewPlayer } from "../engine";
import { createBoard } from "../board";
import { database, ensureSignedIn } from "./firebase";
import type { RtdbBackend, CommitResult, GameMeta, SeatLink } from "./types";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomId(len: number): string {
  const buf = new Uint32Array(len);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ID_ALPHABET[buf[i]! % ID_ALPHABET.length];
  return out;
}

export interface CreateGameInput {
  players: NewPlayer[];
  mode: "beginner" | "random";
}

/** Writes a new game (state + meta + claim tokens) and returns its id + per-seat links. */
export async function createGame(input: CreateGameInput): Promise<{ id: string; links: SeatLink[] }> {
  await ensureSignedIn();
  const id = randomId(6);
  const board = input.mode === "random"
    ? createBoard({ mode: "random", rng: cryptoRng() })
    : createBoard({ mode: "beginner" });
  const state = createInitialGame(input.players, board);
  const meta: GameMeta = {
    createdAt: Date.now(),
    playerCount: input.players.length,
    names: input.players.map((p) => p.name),
    seatColors: input.players.map((p) => p.color),
  };
  const tokens = input.players.map(() => randomId(16));

  await set(ref(database(), `games/${id}/state`), state);
  await set(ref(database(), `games/${id}/meta`), meta);
  for (let i = 0; i < tokens.length; i++) {
    await set(ref(database(), `games/${id}/_claims/${i}`), tokens[i]);
  }

  const base = `${location.origin}${location.pathname}`;
  const links: SeatLink[] = tokens.map((t, seat) => ({
    seat,
    url: `${base}#/g/${id}/claim/${seat}/${t}`,
  }));
  return { id, links };
}

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
      return onValue(stateRef, (snap) => cb((snap.val() as GameState | null) ?? null));
    },
    async commit(update): Promise<CommitResult> {
      let abortError: string | null = null;
      const tx = await runTransaction(stateRef, (current: GameState | null) => {
        const next = update(current);
        if (typeof next === "string") { abortError = next; return undefined; } // abort
        return next;
      });
      if (abortError !== null) return { ok: false, error: abortError };
      if (!tx.committed) return { ok: false, error: "The board changed — please retry." };
      return { ok: true, state: tx.snapshot.val() as GameState };
    },
  };
}

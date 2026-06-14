import { ref, get, set, update, onValue } from "firebase/database";
import { createInitialGame, cryptoRng } from "../engine";
import { createBoard } from "../board";
import { database, ensureSignedIn } from "./firebase";
import type { GameMeta, SeatLink } from "./types";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomId(len: number): string {
  const buf = new Uint32Array(len);
  globalThis.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += ID_ALPHABET[buf[i]! % ID_ALPHABET.length];
  return out;
}

export const MAX_SLOTS = 4;

export interface LobbySeat {
  uid: string;
  name: string;
  color: string;
}

export interface LobbyView {
  meta: GameMeta | null;
  roster: Record<number, LobbySeat>;
  myUid: string;
}

/** Lobby operations behind an interface so the Lobby screen can be tested with a fake. */
export interface LobbyBackend {
  subscribe(cb: (v: LobbyView) => void): () => void;
  claim(slot: number, name: string, color: string): Promise<void>;
  leave(slot: number): Promise<void>;
  kick(slot: number): Promise<void>;
  setMode(mode: GameMeta["mode"]): Promise<void>;
  /** Freezes the roster, creates the game state, flips status to active. */
  start(): Promise<void>;
}

/** One-tap create: writes meta and returns the new game id; the host joins via the lobby. */
export async function createLobby(): Promise<string> {
  const uid = await ensureSignedIn();
  const id = randomId(6);
  const meta: GameMeta = { createdAt: Date.now(), host: uid, status: "lobby", mode: "beginner" };
  await set(ref(database(), `games/${id}/meta`), meta);
  return id;
}

export async function getMeta(id: string): Promise<GameMeta | null> {
  await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/meta`));
  return snap.val() as GameMeta | null;
}

const claimsKey = (id: string) => `adultingcatan:claims:${id}`;

function linksFromClaims(id: string, claims: Record<string, string>): SeatLink[] {
  const base = `${location.origin}${location.pathname}`;
  return Object.keys(claims).map(Number).sort((a, b) => a - b)
    .map((seat) => ({ seat, url: `${base}#/g/${id}/claim/${seat}/${claims[seat]!}` }));
}

function saveRescueLinks(id: string, links: SeatLink[]): void {
  try { localStorage.setItem(claimsKey(id), JSON.stringify(links)); } catch { /* non-fatal */ }
}

/** Rescue links cached on this device, if they have already been loaded or minted. */
export function hostRescueLinks(id: string): SeatLink[] | null {
  try {
    const raw = localStorage.getItem(claimsKey(id));
    return raw ? (JSON.parse(raw) as SeatLink[]) : null;
  } catch {
    return null;
  }
}

/** Loads recovery links from the shared game record so any player can recover any seat. */
export async function loadRescueLinks(id: string): Promise<SeatLink[] | null> {
  const cached = hostRescueLinks(id);
  if (cached !== null) return cached;
  await ensureSignedIn();
  const snap = await get(ref(database(), `games/${id}/_claims`));
  const claims = snap.val() as Record<string, string> | null;
  if (claims === null) return null;
  const links = linksFromClaims(id, claims);
  saveRescueLinks(id, links);
  return links;
}

export function makeLobbyBackend(id: string): LobbyBackend {
  const gameRef = ref(database(), `games/${id}`);
  return {
    subscribe(cb) {
      let meta: GameMeta | null = null;
      let roster: Record<number, LobbySeat> = {};
      let myUid = "";
      let metaSeen = false;
      const emit = () => { if (metaSeen && myUid) cb({ meta, roster, myUid }); };
      let unsubMeta = () => {};
      let unsubLobby = () => {};
      void ensureSignedIn().then((uid) => {
        myUid = uid;
        unsubMeta = onValue(ref(database(), `games/${id}/meta`), (s) => {
          meta = s.val() as GameMeta | null;
          metaSeen = true;
          emit();
        });
        unsubLobby = onValue(ref(database(), `games/${id}/lobby`), (s) => {
          roster = (s.val() ?? {}) as Record<number, LobbySeat>;
          emit();
        });
      });
      return () => { unsubMeta(); unsubLobby(); };
    },
    async claim(slot, name, color) {
      const uid = await ensureSignedIn();
      await set(ref(database(), `games/${id}/lobby/${slot}`), { uid, name, color });
    },
    async leave(slot) {
      await set(ref(database(), `games/${id}/lobby/${slot}`), null);
    },
    async kick(slot) {
      await set(ref(database(), `games/${id}/lobby/${slot}`), null);
    },
    async setMode(mode) {
      await set(ref(database(), `games/${id}/meta/mode`), mode);
    },
    async start() {
      await ensureSignedIn();
      const [metaSnap, lobbySnap] = await Promise.all([
        get(ref(database(), `games/${id}/meta`)),
        get(ref(database(), `games/${id}/lobby`)),
      ]);
      const meta = metaSnap.val() as GameMeta;
      const slots = (lobbySnap.val() ?? {}) as Record<string, LobbySeat>;
      const roster = Object.keys(slots).map(Number).sort((a, b) => a - b).map((k) => slots[k]!);
      const board = meta.mode === "random"
        ? createBoard({ mode: "random", rng: cryptoRng() })
        : createBoard({ mode: "beginner" });
      const state = createInitialGame(roster.map((s) => ({ name: s.name, color: s.color })), board, cryptoRng());
      const tokens = roster.map(() => randomId(16));

      // One atomic multi-path update: roster freeze, rescue tokens, state, status flip.
      const updates: Record<string, unknown> = { state, "meta/status": "active" };
      roster.forEach((s, seat) => {
        updates[`seats/${seat}`] = { uid: s.uid };
        updates[`_claims/${seat}`] = tokens[seat];
      });
      await update(gameRef, updates);

      const links = linksFromClaims(id, Object.fromEntries(tokens.map((t, seat) => [seat, t])));
      saveRescueLinks(id, links);
    },
  };
}

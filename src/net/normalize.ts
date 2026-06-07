import type { GameState } from "../engine/types";
import { emptyResources } from "../engine";
import { recomputeVictoryPoints } from "../engine/scoring/victory";

/**
 * Firebase RTDB does not store empty objects or arrays — a field that was `{}` or
 * `[]` when written comes back `undefined`. Rehydrate every collection the engine and
 * UI expect to exist, so a freshly-created game (all collections empty) survives the
 * round-trip. Mutates and returns a usable GameState; null passes through (missing game).
 */
export function normalizeState(raw: GameState | null): GameState | null {
  if (raw === null || raw === undefined) return null;
  const s = raw as GameState;

  s.board = s.board ?? ({} as GameState["board"]);
  s.board.tiles = s.board.tiles ?? {};
  s.board.ports = s.board.ports ?? [];
  s.board.buildings = s.board.buildings ?? {};
  s.board.roads = s.board.roads ?? {};

  s.log = s.log ?? [];
  s.tradeOffers = s.tradeOffers ?? [];
  s.awards = s.awards ?? {};
  s.devDeck = s.devDeck ?? [];

  s.players = (s.players ?? []).map((p) => ({
    ...p,
    resources: { ...emptyResources(), ...(p.resources ?? {}) },
    devCards: p.devCards ?? [],
  }));

  // Migration for games saved before hidden VP cards were made private: those
  // snapshots may have `player.victoryPoints` with VP dev cards folded in. The
  // current engine treats this field as public VP, so recompute it on load from
  // buildings/awards only. Own/finished displays still add hidden VP via helpers.
  for (const p of s.players) recomputeVictoryPoints(s, p.seat);

  return s;
}

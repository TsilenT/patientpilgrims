export type Route =
  | { kind: "start" }
  | { kind: "hotseat" }
  | { kind: "join" }
  | { kind: "game"; id: string }
  | { kind: "claim"; id: string; seat: number; token: string };

/** Pure parse of `location.hash` into a Route. Unknown shapes → start. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\//, ""); // "g/abc/claim/2/tok"
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "start" };
  if (parts[0] === "hotseat") return { kind: "hotseat" };
  if (parts[0] === "join") return { kind: "join" };
  if (parts[0] === "g" && parts.length === 2) return { kind: "game", id: parts[1]! };
  if (parts[0] === "g" && parts[2] === "claim" && parts.length === 5) {
    return { kind: "claim", id: parts[1]!, seat: Number(parts[3]), token: parts[4]! };
  }
  return { kind: "start" };
}

/** Resolves pasted codes/invites without discarding recovery credentials. */
export function extractJoinHash(text: string): string | null {
  const input = text.trim();
  if (/^[a-z0-9]{4,12}$/i.test(input)) return `#/g/${input.toLowerCase()}`;

  // Full URLs can include a deployment subpath; only their hash is an app route.
  let hash = input;
  if (!input.startsWith("#/")) {
    try {
      const url = new URL(input);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      hash = url.hash;
    } catch {
      return null;
    }
  }
  const match = hash.match(/^#\/g\/([a-zA-Z0-9]{4,12})(\/claim\/(0|[1-9][0-9]*)\/[^/\s?#]+)?$/);
  if (!match) return null;
  if (match[3] !== undefined && !Number.isSafeInteger(Number(match[3]))) return null;
  // The recovery suffix is opaque: preserve its token and seat exactly.
  return `#/g/${match[1]!.toLowerCase()}${match[2] ?? ""}`;
}

/** Pulls a game id out of a pasted invite link or raw code; null if unrecognizable. */
export function extractGameId(text: string): string | null {
  const linkMatch = text.match(/\/g\/([a-z0-9]+)/i);
  const raw = linkMatch ? linkMatch[1]! : text.trim();
  return /^[a-z0-9]{4,12}$/i.test(raw) ? raw.toLowerCase() : null;
}

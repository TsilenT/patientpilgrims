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

/** Pulls a game id out of a pasted invite link or raw code; null if unrecognizable. */
export function extractGameId(text: string): string | null {
  const linkMatch = text.match(/\/g\/([a-z0-9]+)/i);
  const raw = linkMatch ? linkMatch[1]! : text.trim();
  return /^[a-z0-9]{4,12}$/i.test(raw) ? raw.toLowerCase() : null;
}

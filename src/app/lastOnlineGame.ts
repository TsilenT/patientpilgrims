import { extractGameId } from "./router";

export const LAST_ONLINE_GAME_KEY = "patientpilgrims:last-online-game";

export function loadLastOnlineGameId(): string | null {
  try {
    const raw = localStorage.getItem(LAST_ONLINE_GAME_KEY);
    if (raw === null) return null;
    return extractGameId(raw);
  } catch {
    return null;
  }
}

export function rememberOnlineGame(id: string): string | null {
  const validId = extractGameId(id);
  if (validId === null) return null;
  try { localStorage.setItem(LAST_ONLINE_GAME_KEY, validId); } catch { /* non-fatal */ }
  return validId;
}
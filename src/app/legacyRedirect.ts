import { HOTSEAT_SAVE_KEY } from "../state/persistence";

const NEW_ORIGIN = "https://patientpilgrims.stevets.ai";
const LEGACY_HOST = "stevets.ai";

type Loc = { hostname: string; pathname: string; hash: string };

/**
 * Where a legacy-origin visit should hop to, or null to stay.
 * Stays put for game/claim/lobby hashes (anonymous-auth UIDs are origin-bound;
 * in-flight seats must keep working) and for a saved hotseat game.
 */
export function legacyRedirectTarget(loc: Loc, hasHotseatSave: boolean): string | null {
  if (loc.hostname !== LEGACY_HOST) return null;
  if (loc.hash !== "" && loc.hash !== "#" && loc.hash !== "#/") return null;
  if (hasHotseatSave) return null;
  return NEW_ORIGIN + loc.pathname.replace(/^\/adultingcatan/, "");
}

/** Checks at boot and on every hashchange ("Back to menu" is the migration moment). */
export function installLegacyRedirect(
  loc: Loc & { replace(url: string): void } = window.location,
  listen: (fn: () => void) => void = (fn) => window.addEventListener("hashchange", fn),
): void {
  const check = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(HOTSEAT_SAVE_KEY); } catch { /* private mode */ }
    const target = legacyRedirectTarget(loc, saved !== null);
    if (target !== null) loc.replace(target);
  };
  check();
  listen(check);
}

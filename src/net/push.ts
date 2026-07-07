import { readVapidPublicKey } from "./config";
import { savePushSub, removePushSub } from "./pushSubs";

export type PushState = "unsupported" | "off" | "on" | "blocked";

/** True only when this browser can do Web Push (absent on non-installed iOS). */
export function pushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window &&
    readVapidPublicKey() !== null
  );
}

/** Decode a base64url VAPID key into the Uint8Array applicationServerKey wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  // atob throws on malformed input; a real VAPID key never is, but stay robust.
  let raw = "";
  try {
    raw = atob(normalized);
  } catch {
    raw = "";
  }
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Current push state for this browser (reads permission + existing subscription). */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
}

/** Ask permission, subscribe, and persist. Must be called from a user gesture. */
export async function enablePush(uid: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(readVapidPublicKey()!),
  });
  await savePushSub(uid, sub.toJSON());
  return "on";
}

/** Unsubscribe locally and delete the stored subscription. */
export async function disablePush(uid: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sub.unsubscribe();
  await removePushSub(uid);
}

/** On app startup: if already granted, re-write the current subscription so a
 *  rotated endpoint is picked up before any send fails. No-op otherwise. */
export async function resyncPush(uid: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await savePushSub(uid, sub.toJSON());
}

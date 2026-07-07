import { ref, set, remove } from "firebase/database";
import { database } from "./firebase";

/** Store this browser's push subscription under its uid (last-write-wins). */
export function savePushSub(uid: string, subscription: PushSubscriptionJSON): Promise<void> {
  return set(ref(database(), `pushSubs/${uid}`), { subscription, updatedAt: Date.now() });
}

/** Remove this browser's stored subscription. */
export function removePushSub(uid: string): Promise<void> {
  return remove(ref(database(), `pushSubs/${uid}`));
}
